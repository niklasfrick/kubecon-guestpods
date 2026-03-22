package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	qrcode "github.com/skip2/go-qrcode"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	store         *Store
	hub           *SSEHub
	checker       *ProfanityChecker
	baseURL       string
	sessions      *SessionStore
	adminPassword string
	adminState    *AdminState
}

// NewHandler creates a new Handler with all dependencies injected.
func NewHandler(store *Store, hub *SSEHub, checker *ProfanityChecker, baseURL string, sessions *SessionStore, adminPassword string, adminState *AdminState) *Handler {
	return &Handler{
		store:         store,
		hub:           hub,
		checker:       checker,
		baseURL:       baseURL,
		sessions:      sessions,
		adminPassword: adminPassword,
		adminState:    adminState,
	}
}

// AdminState manages the open/closed state of submissions.
// In-memory for fast reads on every form submission, persisted to SQLite for restart survival.
type AdminState struct {
	mu    sync.RWMutex
	open  bool
	store *Store
}

// NewAdminState creates an AdminState, restoring state from SQLite if previously persisted.
func NewAdminState(store *Store) *AdminState {
	state := &AdminState{open: true, store: store}
	// Restore state from SQLite on startup
	val, err := store.GetConfig("submissions_open")
	if err == nil && val == "false" {
		state.open = false
	}
	// Default: open (first run, or if config not set)
	return state
}

// IsOpen returns whether submissions are currently open.
func (a *AdminState) IsOpen() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.open
}

// Toggle flips the open/closed state, persists to SQLite, and returns the new state.
func (a *AdminState) Toggle() (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.open = !a.open
	err := a.store.SetConfig("submissions_open", fmt.Sprintf("%t", a.open))
	return a.open, err
}

// HandleSubmit returns an http.HandlerFunc for POST /api/submissions.
// It validates the request, checks for profanity, persists to SQLite,
// broadcasts via SSE, and returns the submission response.
func (h *Handler) HandleSubmit() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.adminState.IsOpen() {
			writeJSON(w, http.StatusForbidden, ErrorResponse{Error: "Submissions are closed"})
			return
		}

		var req SubmitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid JSON body"})
			return
		}

		// Trim whitespace from name
		req.Name = strings.TrimSpace(req.Name)

		// Validate fields
		if errResp := Validate(req); errResp != nil {
			writeJSON(w, http.StatusBadRequest, errResp)
			return
		}

		// Check profanity
		if h.checker.IsProfane(req.Name) {
			writeJSON(w, http.StatusUnprocessableEntity, ErrorResponse{
				Error: "That name wasn't accepted. Try a different one.",
				Field: "name",
			})
			return
		}

		// Persist to database
		resp, err := h.store.Insert(req)
		if err != nil {
			log.Printf("ERROR: insert submission: %v", err)
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to save submission"})
			return
		}

		// Broadcast via SSE
		data, err := json.Marshal(resp)
		if err != nil {
			log.Printf("ERROR: marshal submission for SSE: %v", err)
		} else {
			h.hub.Broadcast(data)
		}

		// Return 201 with submission response
		writeJSON(w, http.StatusCreated, resp)
	}
}

// HandleQRCode returns an http.HandlerFunc for GET /api/qr.
// It generates a QR code PNG for the base URL.
func (h *Handler) HandleQRCode() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		png, err := qrcode.Encode(h.baseURL, qrcode.Medium, 512)
		if err != nil {
			log.Printf("ERROR: generate QR code: %v", err)
			http.Error(w, "Failed to generate QR code", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "image/png")
		w.Write(png)
	}
}

// HandleGetSubmissions returns an http.HandlerFunc for GET /api/submissions.
// It returns all non-deleted submissions as a JSON array.
func (h *Handler) HandleGetSubmissions() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		submissions, err := h.store.GetAll()
		if err != nil {
			log.Printf("ERROR: get submissions: %v", err)
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to load submissions"})
			return
		}
		writeJSON(w, http.StatusOK, submissions)
	}
}

// HandleHealth returns an http.HandlerFunc for GET /api/health.
func (h *Handler) HandleHealth() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// writeJSON marshals v to JSON and writes it to the response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("ERROR: write JSON response: %v", err)
	}
}
