package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// setupAdminTestHandler creates a Handler with admin dependencies for testing.
func setupAdminTestHandler(t *testing.T) (*Handler, *SessionStore, func()) {
	t.Helper()
	tmpDir := t.TempDir()
	store, err := NewStore(filepath.Join(tmpDir, "test.db"))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	hub := NewSSEHub()
	checker := NewProfanityChecker()
	sessions := NewSessionStore()
	adminState := NewAdminState(store)
	handler := NewHandler(store, hub, checker, "http://test.local", sessions, "test-password", adminState)
	cleanup := func() { store.Close() }
	return handler, sessions, cleanup
}

func TestAdminLogin_CorrectPassword(t *testing.T) {
	h, _, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	body := `{"password":"test-password"}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleAdminLogin().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Check for admin_session cookie
	cookies := rr.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "admin_session" && c.Value != "" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected admin_session cookie to be set")
	}
}

func TestAdminLogin_WrongPassword(t *testing.T) {
	h, _, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	body := `{"password":"wrong-password"}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleAdminLogin().ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestAdminLogin_EmptyBody(t *testing.T) {
	h, _, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleAdminLogin().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestToggle_OpenToClosedToOpen(t *testing.T) {
	h, sessions, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	token := sessions.Create(1 * time.Hour)

	// Toggle from open (default) to closed
	req := httptest.NewRequest(http.MethodPost, "/api/admin/toggle", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	rr := httptest.NewRecorder()

	h.HandleToggle().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]bool
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["submissions_open"] != false {
		t.Errorf("expected submissions_open=false, got %v", resp["submissions_open"])
	}

	// Toggle back to open
	req = httptest.NewRequest(http.MethodPost, "/api/admin/toggle", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	rr = httptest.NewRecorder()

	h.HandleToggle().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 on second toggle, got %d", rr.Code)
	}

	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["submissions_open"] != true {
		t.Errorf("expected submissions_open=true, got %v", resp["submissions_open"])
	}
}

func TestDelete_ValidID(t *testing.T) {
	h, sessions, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	// Insert a submission first
	body := `{"name":"DeleteMe","country_code":"DE","homelab_level":3}`
	submitReq := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	submitReq.Header.Set("Content-Type", "application/json")
	submitRR := httptest.NewRecorder()
	h.HandleSubmit().ServeHTTP(submitRR, submitReq)
	if submitRR.Code != http.StatusCreated {
		t.Fatalf("failed to create submission: %d", submitRR.Code)
	}

	var submitResp SubmitResponse
	json.NewDecoder(submitRR.Body).Decode(&submitResp)

	// Delete the submission
	token := sessions.Create(1 * time.Hour)
	deleteReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/admin/submissions/%d", submitResp.ID), nil)
	deleteReq.SetPathValue("id", fmt.Sprintf("%d", submitResp.ID))
	deleteReq.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	deleteRR := httptest.NewRecorder()

	h.HandleDelete().ServeHTTP(deleteRR, deleteReq)

	if deleteRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", deleteRR.Code, deleteRR.Body.String())
	}

	// Verify it's gone from GetAll
	getReq := httptest.NewRequest(http.MethodGet, "/api/submissions", nil)
	getRR := httptest.NewRecorder()
	h.HandleGetSubmissions().ServeHTTP(getRR, getReq)
	var submissions []SubmitResponse
	json.NewDecoder(getRR.Body).Decode(&submissions)
	if len(submissions) != 0 {
		t.Errorf("expected 0 submissions after delete, got %d", len(submissions))
	}
}

func TestDelete_NonExistentID(t *testing.T) {
	h, sessions, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	token := sessions.Create(1 * time.Hour)
	req := httptest.NewRequest(http.MethodDelete, "/api/admin/submissions/99999", nil)
	req.SetPathValue("id", "99999")
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	rr := httptest.NewRecorder()

	h.HandleDelete().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestStats(t *testing.T) {
	h, sessions, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	// Insert some submissions
	for _, cc := range []string{"DE", "DE", "US", "GB"} {
		body := fmt.Sprintf(`{"name":"Test","country_code":"%s","homelab_level":3}`, cc)
		req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		h.HandleSubmit().ServeHTTP(rr, req)
	}

	token := sessions.Create(1 * time.Hour)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/stats", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	rr := httptest.NewRecorder()

	h.HandleStats().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var stats AdminStats
	if err := json.NewDecoder(rr.Body).Decode(&stats); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	if stats.TotalPods != 4 {
		t.Errorf("expected total_pods 4, got %d", stats.TotalPods)
	}
	if stats.NamespaceCount != 3 {
		t.Errorf("expected namespace_count 3, got %d", stats.NamespaceCount)
	}
	if len(stats.TopLocations) != 3 {
		t.Errorf("expected 3 top locations, got %d", len(stats.TopLocations))
	}
	if !stats.SubmissionsOpen {
		t.Error("expected submissions_open to be true")
	}
}

func TestStatus(t *testing.T) {
	h, sessions, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	token := sessions.Create(1 * time.Hour)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/status", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	rr := httptest.NewRecorder()

	h.HandleStatus().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["authenticated"] != true {
		t.Errorf("expected authenticated=true, got %v", resp["authenticated"])
	}
	if resp["submissions_open"] != true {
		t.Errorf("expected submissions_open=true, got %v", resp["submissions_open"])
	}
}

func TestSubmitWhenClosed(t *testing.T) {
	h, _, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	// Close submissions
	h.adminState.Toggle()

	body := `{"name":"Test","country_code":"DE","homelab_level":3}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d: %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "Submissions are closed") {
		t.Errorf("expected 'Submissions are closed' error, got: %s", rr.Body.String())
	}
}

func TestAdminEndpoints_RequireAuth(t *testing.T) {
	h, _, cleanup := setupAdminTestHandler(t)
	defer cleanup()

	sessions := NewSessionStore()

	// Create an admin mux with auth middleware (simulating the main.go setup)
	adminMux := http.NewServeMux()
	adminMux.HandleFunc("POST /api/admin/toggle", h.HandleToggle())
	adminMux.HandleFunc("DELETE /api/admin/submissions/{id}", h.HandleDelete())
	adminMux.HandleFunc("GET /api/admin/stats", h.HandleStats())
	adminMux.HandleFunc("GET /api/admin/status", h.HandleStatus())
	protected := AuthMiddleware(sessions, adminMux)

	tests := []struct {
		method string
		path   string
	}{
		{"POST", "/api/admin/toggle"},
		{"DELETE", "/api/admin/submissions/1"},
		{"GET", "/api/admin/stats"},
		{"GET", "/api/admin/status"},
	}

	for _, tc := range tests {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without auth: expected 401, got %d", tc.method, tc.path, rr.Code)
		}
	}
}
