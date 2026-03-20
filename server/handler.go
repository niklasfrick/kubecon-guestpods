package server

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	store   *Store
	hub     *SSEHub
	checker *ProfanityChecker
	baseURL string
}

// NewHandler creates a new Handler with all dependencies injected.
func NewHandler(store *Store, hub *SSEHub, checker *ProfanityChecker, baseURL string) *Handler {
	return &Handler{
		store:   store,
		hub:     hub,
		checker: checker,
		baseURL: baseURL,
	}
}

// HandleSubmit returns an http.HandlerFunc for POST /api/submissions.
// It validates the request, checks for profanity, persists to SQLite,
// broadcasts via SSE, and returns the submission response.
func (h *Handler) HandleSubmit() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
