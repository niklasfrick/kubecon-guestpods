package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// setupTestHandler creates a Handler backed by a temp SQLite database.
// Returns the handler and a cleanup function.
func setupTestHandler(t *testing.T) (*Handler, func()) {
	t.Helper()
	tmpDir := t.TempDir()
	store, err := NewStore(filepath.Join(tmpDir, "test.db"))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	hub := NewSSEHub()
	checker := NewProfanityChecker()
	handler := NewHandler(store, hub, checker, "http://test.local")
	cleanup := func() { store.Close() }
	return handler, cleanup
}

func TestSubmitHandler_ValidSubmission(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	body := `{"name":"Niklas","country_code":"DE","homelab_level":3}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp SubmitResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.ID <= 0 {
		t.Errorf("expected ID > 0, got %d", resp.ID)
	}
	if resp.CountryFlag == "" {
		t.Error("expected non-empty CountryFlag")
	}
	if resp.HomelabEmoji == "" {
		t.Error("expected non-empty HomelabEmoji")
	}
	if resp.Name != "Niklas" {
		t.Errorf("expected name Niklas, got %s", resp.Name)
	}
}

func TestSubmitHandler_EmptyName(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	body := `{"name":"","country_code":"DE","homelab_level":3}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Enter your name to join the cluster") {
		t.Errorf("expected error message about name, got: %s", rr.Body.String())
	}
}

func TestSubmitHandler_NameTooLong(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	longName := strings.Repeat("A", 31)
	body, _ := json.Marshal(SubmitRequest{Name: longName, CountryCode: "DE", HomelabLevel: 3})
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "30 characters or fewer") {
		t.Errorf("expected length error, got: %s", rr.Body.String())
	}
}

func TestSubmitHandler_InvalidCountry(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	body := `{"name":"Test","country_code":"XX","homelab_level":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Select where you're from") {
		t.Errorf("expected country error, got: %s", rr.Body.String())
	}
}

func TestSubmitHandler_InvalidHomelabLevel(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	// Test level 0
	body := `{"name":"Test","country_code":"DE","homelab_level":0}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("homelab_level=0: expected status 400, got %d", rr.Code)
	}

	// Test level 6
	body = `{"name":"Test","country_code":"DE","homelab_level":6}`
	req = httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("homelab_level=6: expected status 400, got %d", rr.Code)
	}
}

func TestSubmitHandler_ProfaneName(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	body := `{"name":"asshole","country_code":"DE","homelab_level":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/submissions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.HandleSubmit().ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d: %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "That name wasn't accepted") {
		t.Errorf("expected profanity error, got: %s", rr.Body.String())
	}
}

func TestQRCode(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/qr", nil)
	rr := httptest.NewRecorder()

	h.HandleQRCode().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "image/png") {
		t.Errorf("expected Content-Type image/png, got %s", ct)
	}

	// Check PNG magic bytes: 0x89 P N G
	body := rr.Body.Bytes()
	if len(body) < 4 {
		t.Fatal("response body too short for PNG")
	}
	pngMagic := []byte{0x89, 0x50, 0x4E, 0x47}
	for i, b := range pngMagic {
		if body[i] != b {
			t.Errorf("PNG magic byte %d: expected 0x%02X, got 0x%02X", i, b, body[i])
		}
	}
}

func TestHealth(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()

	h.HandleHealth().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "ok") {
		t.Errorf("expected body to contain 'ok', got: %s", rr.Body.String())
	}
}

func TestSSEStream(t *testing.T) {
	hub := NewSSEHub()

	// Use httptest.Server to avoid data race on ResponseRecorder headers
	ts := httptest.NewServer(hub.HandleSSE())
	defer ts.Close()

	// Use a transport with DisableKeepAlives to ensure clean shutdown
	client := &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
	}

	req, err := http.NewRequest(http.MethodGet, ts.URL, nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	type result struct {
		resp *http.Response
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		resp, err := client.Do(req)
		ch <- result{resp, err}
	}()

	// The Do call returns as soon as headers are received (before body completes)
	// because SSE is a streaming response
	select {
	case r := <-ch:
		if r.err != nil {
			t.Fatalf("SSE request: %v", r.err)
		}
		defer r.resp.Body.Close()

		if r.resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", r.resp.StatusCode)
		}

		ct := r.resp.Header.Get("Content-Type")
		if !strings.Contains(ct, "text/event-stream") {
			t.Errorf("expected Content-Type text/event-stream, got %s", ct)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("SSE request timed out waiting for headers")
	}
}
