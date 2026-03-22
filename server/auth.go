package server

import (
	"crypto/rand"
	"crypto/subtle"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SessionStore manages in-memory sessions with expiry times.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]time.Time // token -> expiry
}

// NewSessionStore creates a new empty SessionStore.
func NewSessionStore() *SessionStore {
	return &SessionStore{sessions: make(map[string]time.Time)}
}

// Create generates a cryptographic session token and stores it with the given max age.
// Returns the token string.
func (s *SessionStore) Create(maxAge time.Duration) string {
	token := rand.Text() // crypto/rand.Text, Go 1.24+, 128+ bits entropy
	s.mu.Lock()
	s.sessions[token] = time.Now().Add(maxAge)
	s.mu.Unlock()
	return token
}

// Valid checks if a session token exists and has not expired.
func (s *SessionStore) Valid(token string) bool {
	s.mu.RLock()
	expiry, ok := s.sessions[token]
	s.mu.RUnlock()
	return ok && time.Now().Before(expiry)
}

// CheckPassword uses constant-time comparison to prevent timing attacks.
func CheckPassword(input, expected string) bool {
	return subtle.ConstantTimeCompare([]byte(input), []byte(expected)) == 1
}

// AuthMiddleware checks for valid admin_session cookie. Returns 401 JSON for API routes,
// plain 401 for other routes (frontend handles redirect to login form).
func AuthMiddleware(sessions *SessionStore, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("admin_session")
		if err != nil || !sessions.Valid(cookie.Value) {
			if strings.HasPrefix(r.URL.Path, "/api/admin") {
				writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "Unauthorized"})
				return
			}
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
