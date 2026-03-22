# Phase 3: Admin Panel - Research

**Researched:** 2026-03-22
**Domain:** Go stdlib session auth, SQLite state management, SSE event extension, Preact admin UI
**Confidence:** HIGH

## Summary

Phase 3 builds a presenter control panel for managing the guestbook during and after a live talk. The entire stack is already established from Phases 1 and 2 -- Go 1.26 with net/http, Preact + Vite + TypeScript, SQLite via modernc.org/sqlite, and SSE via the existing SSEHub. No new dependencies are needed. The admin panel adds: (1) password-based auth with cookie sessions using Go stdlib only, (2) API endpoints for toggle/delete/stats protected by auth middleware, (3) SSE event extension for deletion broadcasts, (4) a Preact admin page at `/admin`, and (5) a config table in SQLite for persisting open/closed state across restarts.

The codebase has clean patterns to extend: `Handler` struct with dependency injection, middleware chain (CORS -> Logging -> mux), Go 1.22+ method patterns on mux, embedded frontend via `embed.go`, and Preact signals for reactive state. The `deleted BOOLEAN` column already exists in the submissions table, and `GetAll()` already filters with `WHERE deleted = FALSE`. The frontend already handles 403 on submission by redirecting to `/viz`.

**Primary recommendation:** Implement everything with Go stdlib + existing patterns. Use `crypto/rand.Text()` for session tokens, in-memory `map[string]time.Time` for session store, `sync.RWMutex` for thread-safe state. No external auth libraries needed for a single shared-secret password.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Simple password login page at `/admin` -- shared secret set via environment variable
- Cookie-based session -- persists across browser refreshes, no re-entering password mid-talk
- Admin API endpoints (toggle, delete) are also protected by the same session cookie -- not just the UI
- Route pattern: `/admin` for login, `/admin` dashboard after auth (consistent with existing `/viz` pattern)
- Compact single-screen "control bar" layout -- everything visible at once, no tabs or scrolling for key actions
- Big toggle button at top, stats in the middle, submission list at bottom
- Stats: total pods, namespace count, top 3-5 locations by count -- numbers only, no charts
- Stats update in real-time via the existing SSE stream (same infrastructure as viz)
- K8s-themed language throughout -- consistent with Phase 1 and 2 decisions
- Inline delete button on each submission row in the list
- Delete requires a confirmation dialog ("Delete this pod?") -- two clicks for safety
- Soft-delete in DB (column already exists in schema) -- `deleted = TRUE`
- Deletion broadcast via new SSE event type (e.g., `event: deletion` with pod ID)
- Viz removes the pod instantly on receiving the deletion event (no fade animation)
- Submission list is reverse-chronological (newest first), no search or filtering
- New submissions appear at the top of the list in real-time via SSE -- live feed for reactive moderation
- Toggle button flips between CLOSE and REOPEN -- admin can reopen submissions if needed
- Open/closed state stored in-memory for fast reads, persisted to a config table in SQLite for restart survival
- When closed: form URL redirects to /viz (already implemented -- server returns 403, frontend redirects)
- Visualization stays exactly the same when closed -- no banner, no frozen animations
- Admin panel remains fully functional when closed (stats, list, moderation, reopen toggle)

### Claude's Discretion
- Admin panel CSS styling and dark/light theme
- Session cookie implementation details (expiry, secure flags)
- Config table schema for open/closed state
- SSE deletion event payload format
- Exact K8s-themed copy for toggle button states and panel headings
- How to serve the admin panel (embedded in same Preact app or separate)
- Password hashing approach (bcrypt, argon2, or plain comparison for env var secret)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Admin can open and close submissions with a single toggle button | Toggle API endpoint, in-memory state + SQLite config table persistence, SSE broadcast of state change |
| ADMN-02 | Admin panel shows real-time stats (total submissions, submissions over time, top locations) | Stats API endpoint with SQL aggregation queries, SSE listener in admin frontend for live updates |
| ADMN-03 | Admin can delete individual pod entries for reactive moderation | Delete API endpoint with soft-delete, SSE deletion event broadcast, viz-side node removal |
| ADMN-04 | Guestbook transitions to read-only mode when submissions are closed (post-talk artifact) | Submission handler checks in-memory state, returns 403 when closed (frontend redirect already implemented) |
| ADMN-05 | Admin panel is protected by authentication (simple password or shared secret) | Cookie-based session auth with Go stdlib, auth middleware on admin API routes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go stdlib `net/http` | Go 1.26.1 | HTTP server, routing, cookies, middleware | Already in use, no external auth needed for shared-secret pattern |
| Go stdlib `crypto/rand` | Go 1.26.1 | Session token generation via `rand.Text()` | Stdlib since Go 1.24, 128+ bits entropy, perfect for session IDs |
| Go stdlib `crypto/subtle` | Go 1.26.1 | Constant-time password comparison | Prevents timing attacks on password check |
| Preact | ^10.29.0 | Admin panel UI | Already in use for form and viz |
| @preact/signals | ^2.0.0 | Reactive admin state | Already in use |
| modernc.org/sqlite | 1.47.0 | Config table for open/closed state | Already in use, pure Go |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-scale | ^4.0.2 | Already installed, not needed for admin | Not used in this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory session map | gorilla/sessions | Adds dependency for a single shared secret -- unnecessary |
| Plain env var compare | bcrypt/argon2 | Overkill -- password is an env var, not user-chosen. Use `crypto/subtle.ConstantTimeCompare` instead |
| Separate admin app | Embedded in same Preact app | Same binary, same embed, no extra build step -- follows existing pattern |

**Installation:**
```bash
# No new dependencies needed -- all stdlib + existing packages
```

## Architecture Patterns

### Recommended Project Structure
```
server/
  admin.go          # Admin handler methods (login, toggle, delete, stats)
  auth.go           # AuthMiddleware, SessionStore, password check
  store.go          # Add: Delete(), GetStats(), config table methods
  sse.go            # Add: BroadcastEvent() with event type parameter
  handler.go        # Existing -- add submissionsOpen state check
  middleware.go     # Existing CORS/Logging
  model.go          # Add: AdminStats, ConfigEntry types
web/src/
  admin/
    AdminPage.tsx   # Main admin panel component
    LoginForm.tsx   # Password login form
    ToggleButton.tsx # Open/close submissions toggle
    PodList.tsx     # Real-time submission list with delete
    StatsPanel.tsx  # Live stats display
    adminApi.ts     # Admin API client functions
```

### Pattern 1: Cookie Session Authentication (stdlib-only)
**What:** In-memory session store with `map[string]time.Time` protected by `sync.RWMutex`. Session token generated by `crypto/rand.Text()`. Password compared with `crypto/subtle.ConstantTimeCompare`.
**When to use:** Single shared-secret auth, no user accounts, no password hashing needed.
**Example:**
```go
// Source: Go stdlib crypto/rand docs + net/http cookie docs
package server

import (
    "crypto/rand"
    "crypto/subtle"
    "net/http"
    "sync"
    "time"
)

type SessionStore struct {
    mu       sync.RWMutex
    sessions map[string]time.Time // token -> expiry
}

func NewSessionStore() *SessionStore {
    return &SessionStore{sessions: make(map[string]time.Time)}
}

func (s *SessionStore) Create(maxAge time.Duration) string {
    token := rand.Text() // 128+ bits entropy, base32 encoded
    s.mu.Lock()
    s.sessions[token] = time.Now().Add(maxAge)
    s.mu.Unlock()
    return token
}

func (s *SessionStore) Valid(token string) bool {
    s.mu.RLock()
    expiry, ok := s.sessions[token]
    s.mu.RUnlock()
    return ok && time.Now().Before(expiry)
}

// CheckPassword uses constant-time comparison to prevent timing attacks
func CheckPassword(input, expected string) bool {
    return subtle.ConstantTimeCompare([]byte(input), []byte(expected)) == 1
}
```

### Pattern 2: Auth Middleware (wraps admin routes only)
**What:** Middleware that checks session cookie before passing request to admin handlers. Returns 401 for API routes, redirects to login for page routes.
**When to use:** Protecting admin API endpoints and the admin panel page.
**Example:**
```go
// Source: Go net/http middleware pattern (existing in server/middleware.go)
func AuthMiddleware(sessions *SessionStore, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        cookie, err := r.Cookie("admin_session")
        if err != nil || !sessions.Valid(cookie.Value) {
            // For API requests, return 401 JSON
            if strings.HasPrefix(r.URL.Path, "/api/admin") {
                writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "Unauthorized"})
                return
            }
            // For page requests, show login form
            // (handled by frontend -- unauthenticated /admin renders LoginForm)
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### Pattern 3: SSE Event Types (extending existing hub)
**What:** Modify `SSEHub.HandleSSE()` to support multiple event types. The `Broadcast` method already sends raw bytes -- the event type formatting happens in `HandleSSE`. Add a new method or modify to accept event type + data.
**When to use:** Broadcasting deletion events alongside submission events.
**Example:**
```go
// Extend SSEHub to support typed events
// Currently hardcoded: fmt.Fprintf(w, "event: submission\ndata: %s\n\n", data)
// Change to: pass event type with data

type SSEEvent struct {
    Type string // "submission", "deletion", "state"
    Data []byte
}

// Modify Broadcast to accept SSEEvent instead of []byte
func (h *SSEHub) BroadcastEvent(event SSEEvent) {
    msg := fmt.Sprintf("event: %s\ndata: %s\n\n", event.Type, event.Data)
    h.mu.RLock()
    defer h.mu.RUnlock()
    for ch := range h.subscribers {
        select {
        case ch <- []byte(msg):
        default:
        }
    }
}
```

### Pattern 4: In-Memory State with SQLite Persistence
**What:** Open/closed state held in a Go variable (atomic or mutex-protected) for fast reads on every form submission. On toggle, update both in-memory and SQLite. On startup, read from SQLite to restore state.
**When to use:** State that must be checked on every request (hot path) but survive restarts.
**Example:**
```go
// In Handler or a dedicated AdminState struct
type AdminState struct {
    mu     sync.RWMutex
    open   bool
    store  *Store
}

func (a *AdminState) IsOpen() bool {
    a.mu.RLock()
    defer a.mu.RUnlock()
    return a.open
}

func (a *AdminState) Toggle() (bool, error) {
    a.mu.Lock()
    defer a.mu.Unlock()
    a.open = !a.open
    err := a.store.SetConfig("submissions_open", fmt.Sprintf("%t", a.open))
    return a.open, err
}
```

### Pattern 5: Frontend Route Extension
**What:** Extend existing path-based routing in `app.tsx` to handle `/admin` route. Admin page checks auth status via API call, renders login form or dashboard.
**When to use:** Adding new pages to the existing Preact SPA.
**Example:**
```typescript
// Extend app.tsx routing
export function App() {
  if (window.location.pathname === '/viz') {
    return <VizPage />;
  }
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }
  // ... existing form logic
}
```

### Anti-Patterns to Avoid
- **JWT for single-secret auth:** JWT adds complexity (signing, expiry parsing, token refresh) with zero benefit over server-side sessions for a single password.
- **Polling for stats updates:** Use the existing SSE stream. The admin panel should listen to the same SSE endpoint as the viz and compute stats client-side.
- **Separate SSE endpoint for admin:** Reuse `/api/submissions/stream`. The admin panel is just another SSE consumer that also listens for deletion events.
- **Checking open/closed state in a database query per submission:** Use in-memory state. The hot path must be fast.
- **Hard-delete in database:** The `deleted` column exists for a reason. Soft-delete preserves audit trail and matches existing `GetAll()` filter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session tokens | Custom random string generator | `crypto/rand.Text()` | Cryptographically secure, correct entropy, stdlib since Go 1.24 |
| Password comparison | `==` operator | `crypto/subtle.ConstantTimeCompare` | Prevents timing-based password guessing attacks |
| Cookie management | Manual header writing | `http.SetCookie()` / `r.Cookie()` | Handles encoding, attributes, edge cases correctly |
| Real-time updates | WebSocket implementation or polling | Existing SSEHub (extend with event types) | Already built, proven in viz, EventSource auto-reconnects |
| Confirmation dialog | Custom modal component | Native `window.confirm()` or minimal Preact dialog | Stage use case -- no need for polished modal. Native confirm is fastest to implement and unambiguous |

**Key insight:** This phase is almost entirely plumbing -- connecting existing pieces (SSE, store, routing) with a thin auth layer and admin UI. No new concepts, no new dependencies.

## Common Pitfalls

### Pitfall 1: SSEHub Broadcast Format Breaking Viz
**What goes wrong:** Changing the SSEHub `Broadcast` method signature or the SSE format breaks the existing visualization, which expects `event: submission\ndata: {JSON}\n\n`.
**Why it happens:** The SSE handler currently hardcodes the event type in `HandleSSE()` (`fmt.Fprintf(w, "event: submission\ndata: %s\n\n", data)`). Refactoring this to support multiple event types can accidentally change the format for existing submission events.
**How to avoid:** Keep the existing `Broadcast(data []byte)` method working for backward compatibility. Add a new `BroadcastEvent(SSEEvent)` method. Update `HandleSSE()` to handle both: the channel now carries pre-formatted SSE messages instead of raw JSON.
**Warning signs:** Viz stops showing new pods after admin changes are deployed.

### Pitfall 2: Race Condition on Open/Closed State
**What goes wrong:** Concurrent reads (form submissions checking state) and writes (admin toggling state) without synchronization corrupt state.
**Why it happens:** Go's `map` and `bool` are not thread-safe. The form submission handler runs on many goroutines simultaneously.
**How to avoid:** Use `sync.RWMutex` -- read lock for checking state (form submissions), write lock for toggling (admin). Alternatively, `sync/atomic.Bool` is simpler for a single boolean.
**Warning signs:** Submissions intermittently accepted when closed, or vice versa.

### Pitfall 3: Session Cookie Not Sent on API Requests
**What goes wrong:** Admin API calls (delete, toggle) fail with 401 even after successful login.
**Why it happens:** `fetch()` with default settings may not send cookies to API endpoints on the same origin. Also, if the cookie `Path` is set to `/admin` it won't be sent to `/api/admin/*` endpoints.
**How to avoid:** Set cookie `Path: "/"` so it's sent to all routes. Use `credentials: "same-origin"` in fetch calls (default for same-origin, but be explicit). Set `HttpOnly: true` and `SameSite: Lax`.
**Warning signs:** Login succeeds but subsequent API calls return 401.

### Pitfall 4: Admin Panel Not Embedded in Frontend Build
**What goes wrong:** The admin page renders a blank screen in production because the Go binary serves pre-built static assets via `embed.go`, and the admin route needs to serve `index.html` for SPA routing.
**Why it happens:** The file server serves files from `web/dist`. Requesting `/admin` looks for `web/dist/admin` which doesn't exist (it's a client-side route).
**How to avoid:** The existing Go mux pattern `GET /` already catches all unmatched GET routes and serves the file server. Since Vite builds a single `index.html` with the Preact app, `/admin` should fall through to `index.html` via the file server. However, `http.FileServerFS` returns 404 for paths without matching files. The fix: add a fallback handler that serves `index.html` for SPA routes (`/admin`, `/viz`).
**Warning signs:** `/admin` returns 404 in production but works in dev (Vite dev server handles SPA routing).

### Pitfall 5: Forgetting to Load State on Startup
**What goes wrong:** After a server restart, submissions are open even though the admin closed them before the restart.
**Why it happens:** The in-memory state defaults to `true` (open), and no one reads the persisted state from SQLite on startup.
**How to avoid:** In `NewStore()` or during handler initialization, read the config table and set the in-memory state. Default to open if no config row exists (first run).
**Warning signs:** Admin closes submissions, server restarts (deployment), submissions are mysteriously open again.

### Pitfall 6: Stats Query Performance with Growing Data
**What goes wrong:** The admin stats endpoint does a full table scan on every request.
**Why it happens:** `COUNT(*)`, `GROUP BY country_code`, and `ORDER BY count DESC` without proper indexes.
**How to avoid:** The existing index `idx_submissions_country ON submissions(country_code) WHERE deleted = FALSE` already covers the stats query. For total count, SQLite is fast enough with the partial index. For "submissions over time", keep it simple -- just the total count, not a time series (per CONTEXT.md: "numbers only, no charts").
**Warning signs:** Stats endpoint latency grows linearly with submission count.

## Code Examples

### Admin Login Handler
```go
// Source: Go stdlib net/http + crypto/rand + crypto/subtle
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
            MaxAge:   86400, // 24 hours
            HttpOnly: true,
            SameSite: http.SameSiteLaxMode,
            // Secure: true -- enable when behind HTTPS
        })

        writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
    }
}
```

### Soft-Delete Store Method
```go
// Source: Extends existing server/store.go pattern
func (s *Store) Delete(id int64) error {
    result, err := s.db.Exec("UPDATE submissions SET deleted = TRUE WHERE id = ? AND deleted = FALSE", id)
    if err != nil {
        return fmt.Errorf("soft-delete submission %d: %w", id, err)
    }
    rows, _ := result.RowsAffected()
    if rows == 0 {
        return fmt.Errorf("submission %d not found or already deleted", id)
    }
    return nil
}
```

### Stats Query
```go
// Source: SQLite aggregation, uses existing idx_submissions_country index
func (s *Store) GetStats() (*AdminStats, error) {
    var total int
    err := s.db.QueryRow("SELECT COUNT(*) FROM submissions WHERE deleted = FALSE").Scan(&total)
    if err != nil {
        return nil, fmt.Errorf("count submissions: %w", err)
    }

    rows, err := s.db.Query(`
        SELECT country_code, COUNT(*) as cnt
        FROM submissions WHERE deleted = FALSE
        GROUP BY country_code ORDER BY cnt DESC LIMIT 5
    `)
    if err != nil {
        return nil, fmt.Errorf("top locations: %w", err)
    }
    defer rows.Close()

    var topLocations []LocationStat
    nsCount := 0
    for rows.Next() {
        var ls LocationStat
        if err := rows.Scan(&ls.CountryCode, &ls.Count); err != nil {
            return nil, fmt.Errorf("scan location: %w", err)
        }
        ls.CountryFlag = countryCodeToFlag(ls.CountryCode)
        topLocations = append(topLocations, ls)
        nsCount++
    }

    // Get total namespace count (distinct country codes)
    err = s.db.QueryRow("SELECT COUNT(DISTINCT country_code) FROM submissions WHERE deleted = FALSE").Scan(&nsCount)
    if err != nil {
        return nil, fmt.Errorf("count namespaces: %w", err)
    }

    return &AdminStats{
        TotalPods:    total,
        NamespaceCount: nsCount,
        TopLocations: topLocations,
    }, nil
}
```

### Config Table Schema
```sql
-- Add to NewStore() schema initialization
CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Config Table Access
```go
func (s *Store) GetConfig(key string) (string, error) {
    var value string
    err := s.db.QueryRow("SELECT value FROM config WHERE key = ?", key).Scan(&value)
    if err == sql.ErrNoRows {
        return "", nil // Key not set -- use default
    }
    return value, err
}

func (s *Store) SetConfig(key, value string) error {
    _, err := s.db.Exec(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        key, value, value,
    )
    return err
}
```

### SSE Client Extension (Frontend)
```typescript
// Extend web/src/viz/sseClient.ts to support multiple event types
export function connectSSE(
  onSubmission: (data: SubmitResponse) => void,
  onDeletion?: (data: { id: number }) => void,
): () => void {
  const es = new EventSource('/api/submissions/stream');

  es.addEventListener('submission', (event: MessageEvent) => {
    try {
      const data: SubmitResponse = JSON.parse(event.data);
      onSubmission(data);
    } catch (e) {
      console.error('Failed to parse SSE submission:', e);
    }
  });

  if (onDeletion) {
    es.addEventListener('deletion', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onDeletion(data);
      } catch (e) {
        console.error('Failed to parse SSE deletion:', e);
      }
    });
  }

  es.onerror = () => {
    console.warn('SSE connection error, will auto-reconnect');
  };

  return () => es.close();
}
```

### Admin API Route Registration
```go
// In main.go -- admin routes with auth middleware
// Login endpoint is NOT protected (it's how you authenticate)
mux.HandleFunc("POST /api/admin/login", handler.HandleAdminLogin())

// Protected admin routes -- wrap in auth middleware
adminMux := http.NewServeMux()
adminMux.HandleFunc("POST /api/admin/toggle", handler.HandleToggle())
adminMux.HandleFunc("DELETE /api/admin/submissions/{id}", handler.HandleDelete())
adminMux.HandleFunc("GET /api/admin/stats", handler.HandleStats())
adminMux.HandleFunc("GET /api/admin/status", handler.HandleStatus())

// Apply auth middleware only to admin routes
mux.Handle("/api/admin/", AuthMiddleware(sessions, adminMux))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `crypto/rand` + manual encoding | `crypto/rand.Text()` | Go 1.24 (Feb 2025) | One-liner for secure token generation |
| `math/rand` for tokens | `crypto/rand` always | Long-standing best practice | Security -- never use math/rand for auth |
| JWT for simple auth | Server-side sessions | Always was simpler for same-origin | Less complexity for single-server apps |
| `gorilla/sessions` | stdlib `http.Cookie` + custom store | gorilla/mux archived 2022 | stdlib is sufficient for simple session patterns |

**Deprecated/outdated:**
- `gorilla/sessions`: The gorilla toolkit was archived in 2022. While still functional, new projects should use stdlib where possible. For a single shared-secret, stdlib is more than sufficient.

## Open Questions

1. **SPA Fallback Routing in Production**
   - What we know: Vite dev server handles SPA routing automatically. In production, Go serves files from embedded `web/dist`. `http.FileServerFS` returns 404 for paths like `/admin` that don't map to files.
   - What's unclear: Whether the current `GET /` handler already falls back to `index.html` for unmatched paths, or if a custom handler is needed.
   - Recommendation: Test the current behavior. If `/admin` returns 404, add a fallback handler that serves `index.html` for known SPA routes. Pattern: check if file exists in embedded FS, if not serve `index.html`.

2. **Cookie Secure Flag**
   - What we know: `Secure: true` requires HTTPS. The app will run on a homelab K8s cluster, possibly behind an ingress with TLS termination.
   - What's unclear: Whether the presenter's setup will have HTTPS.
   - Recommendation: Default to `Secure: false` for development, make it configurable via environment variable or auto-detect from `BASE_URL` scheme.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing (stdlib) + httptest |
| Config file | None needed -- Go convention |
| Quick run command | `go test ./server/ -count=1 -run TestAdmin -v` |
| Full suite command | `go test ./server/ -count=1 -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | Toggle submissions open/closed | unit | `go test ./server/ -run TestToggle -v` | No -- Wave 0 |
| ADMN-02 | Stats endpoint returns correct data | unit | `go test ./server/ -run TestStats -v` | No -- Wave 0 |
| ADMN-03 | Delete soft-deletes and broadcasts SSE | unit | `go test ./server/ -run TestDelete -v` | No -- Wave 0 |
| ADMN-04 | Submissions return 403 when closed | unit | `go test ./server/ -run TestSubmitWhenClosed -v` | No -- Wave 0 |
| ADMN-05 | Auth middleware blocks unauthenticated | unit | `go test ./server/ -run TestAuth -v` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `go test ./server/ -count=1 -short`
- **Per wave merge:** `go test ./server/ -count=1 -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/admin_test.go` -- covers ADMN-01 (toggle), ADMN-02 (stats), ADMN-03 (delete), ADMN-04 (closed state)
- [ ] `server/auth_test.go` -- covers ADMN-05 (session creation, validation, middleware, password check)
- [ ] Store methods: `Delete()`, `GetStats()`, `GetConfig()`, `SetConfig()` -- extend `server/store_test.go`
- [ ] Existing test helper `setupTestHandler` in `handler_test.go` needs extension to include session store and admin password

## Sources

### Primary (HIGH confidence)
- Go stdlib `crypto/rand` docs (pkg.go.dev/crypto/rand) -- `rand.Text()` confirmed available in Go 1.26.1
- Go stdlib `crypto/subtle` docs -- `ConstantTimeCompare` for timing-safe comparison
- Go stdlib `net/http` docs -- `http.SetCookie`, `Request.Cookie`, middleware patterns
- Project source code -- all existing patterns verified by reading actual files

### Secondary (MEDIUM confidence)
- [Soham Kamani - Session Cookie Authentication in Golang](https://www.sohamkamani.com/golang/session-cookie-authentication/) -- Go session auth patterns
- [Alex Edwards - Working with Cookies in Go](https://www.alexedwards.net/blog/working-with-cookies-in-go) -- Cookie security attributes
- [Alex Edwards - Making and using HTTP Middleware](https://www.alexedwards.net/blog/making-and-using-middleware) -- Middleware chaining patterns
- [Go Web Examples - Sessions](https://gowebexamples.com/sessions/) -- Session store pattern
- [Questionable Services - Generating Secure Random Numbers Using crypto/rand](https://blog.questionable.services/article/generating-secure-random-numbers-crypto-rand/) -- Token generation best practices

### Tertiary (LOW confidence)
- None -- all findings verified against Go stdlib docs and project source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all stdlib, verified against Go 1.26.1 on this machine
- Architecture: HIGH -- extending well-documented existing patterns in the codebase
- Pitfalls: HIGH -- derived from reading actual source code and understanding integration points
- Validation: HIGH -- existing Go test infrastructure with established patterns in handler_test.go and store_test.go

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- stdlib-only, no fast-moving dependencies)
