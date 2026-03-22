package server

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

// HandleAdminLogin returns a handler for POST /api/admin/login.
// Validates password against the configured admin password, creates session, sets cookie.
func (h *Handler) HandleAdminLogin() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid request"})
			return
		}

		if !CheckPassword(req.Password, h.adminPassword) {
			writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "Invalid password"})
			return
		}

		token := h.sessions.Create(24 * time.Hour)
		http.SetCookie(w, &http.Cookie{
			Name:     "admin_session",
			Value:    token,
			Path:     "/",
			MaxAge:   86400,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// HandleToggle returns a handler for POST /api/admin/toggle.
// Toggles submissions open/closed, persists to SQLite, broadcasts state change.
func (h *Handler) HandleToggle() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isOpen, err := h.adminState.Toggle()
		if err != nil {
			log.Printf("ERROR: toggle submissions: %v", err)
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to toggle submissions"})
			return
		}

		// Broadcast state change via SSE
		stateData, _ := json.Marshal(map[string]bool{"submissions_open": isOpen})
		h.hub.BroadcastEvent(SSEEvent{Type: "state", Data: stateData})

		writeJSON(w, http.StatusOK, map[string]bool{"submissions_open": isOpen})
	}
}

// HandleDelete returns a handler for DELETE /api/admin/submissions/{id}.
// Soft-deletes the submission and broadcasts deletion via SSE.
func (h *Handler) HandleDelete() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid submission ID"})
			return
		}

		if err := h.store.Delete(id); err != nil {
			writeJSON(w, http.StatusNotFound, ErrorResponse{Error: "Pod not found or already deleted"})
			return
		}

		// Broadcast deletion via SSE
		delData, _ := json.Marshal(map[string]int64{"id": id})
		h.hub.BroadcastEvent(SSEEvent{Type: "deletion", Data: delData})

		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

// HandleStats returns a handler for GET /api/admin/stats.
func (h *Handler) HandleStats() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := h.store.GetStats()
		if err != nil {
			log.Printf("ERROR: get stats: %v", err)
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to get stats"})
			return
		}
		stats.SubmissionsOpen = h.adminState.IsOpen()
		writeJSON(w, http.StatusOK, stats)
	}
}

// HandleStatus returns a handler for GET /api/admin/status.
// Used by frontend to check if user has a valid session and get current state.
func (h *Handler) HandleStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"authenticated":    true,
			"submissions_open": h.adminState.IsOpen(),
		})
	}
}
