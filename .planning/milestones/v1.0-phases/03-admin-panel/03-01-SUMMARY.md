---
phase: 03-admin-panel
plan: 01
subsystem: api
tags: [auth, session-cookie, admin, sse, sqlite, soft-delete, spa-fallback]

# Dependency graph
requires:
  - phase: 01-server-core
    provides: "Handler, Store, SSEHub, middleware, SQLite schema, model types"
provides:
  - "SessionStore with crypto/rand tokens and expiry validation"
  - "AuthMiddleware for cookie-based admin route protection"
  - "Admin API endpoints: login, toggle, delete, stats, status"
  - "AdminState with in-memory + SQLite persistence"
  - "Store.Delete, GetStats, GetConfig, SetConfig extensions"
  - "SSEEvent typed broadcasts (submission, deletion, state)"
  - "SPA fallback routing for /admin and /viz client-side routes"
  - "Submission closed-state gate (403 when closed)"
affects: [03-admin-panel]

# Tech tracking
tech-stack:
  added: [crypto/rand.Text, crypto/subtle]
  patterns: [session-cookie-auth, admin-state-pattern, sse-event-types, spa-fallback]

key-files:
  created:
    - server/auth.go
    - server/admin.go
    - server/auth_test.go
    - server/admin_test.go
  modified:
    - server/model.go
    - server/store.go
    - server/sse.go
    - server/handler.go
    - server/handler_test.go
    - server/middleware.go
    - main.go

key-decisions:
  - "crypto/rand.Text() for session tokens -- 128+ bit entropy, Go 1.24+ stdlib"
  - "crypto/subtle.ConstantTimeCompare for password check -- timing attack prevention"
  - "In-memory AdminState with SQLite persistence -- fast reads on every submission, survives restart"
  - "Pre-formatted SSE messages in BroadcastEvent -- channel carries ready-to-write bytes"
  - "SPA fallback checks embedded FS before serving index.html -- supports /admin and /viz routes"

patterns-established:
  - "Session cookie auth: admin_session httpOnly cookie with 24h expiry"
  - "Admin state pattern: mutex-protected in-memory state + SQLite config table backup"
  - "Typed SSE events: SSEEvent struct with Type+Data, BroadcastEvent pre-formats wire format"
  - "Admin mux pattern: separate http.ServeMux wrapped by AuthMiddleware for protected routes"

requirements-completed: [ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 3 Plan 1: Admin Backend Summary

**Session-cookie admin auth with toggle/delete/stats endpoints, typed SSE broadcasts, and SPA fallback routing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T18:17:43Z
- **Completed:** 2026-03-22T18:24:27Z
- **Tasks:** 2 (4 TDD commits total: 2 RED + 2 GREEN)
- **Files modified:** 12

## Accomplishments
- Complete admin authentication system with session cookies (crypto/rand tokens, constant-time password comparison)
- All 5 admin API endpoints functional: login, toggle, delete, stats, status
- Submission gate that returns 403 when submissions are closed, with state persisted to SQLite
- SSE event types supporting submission, deletion, and state change broadcasts
- SPA fallback routing so /admin and /viz paths serve index.html for client-side routing
- 36 tests passing (26 existing + 10 new) with zero regressions

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Types, auth, store extensions, and SSE event support**
   - `26cce55` (test) - Failing tests for auth, store extensions, config
   - `d0dfc2b` (feat) - Auth module, store methods, SSE event types, admin models
2. **Task 2: Admin handlers, submission gate, SPA fallback, route wiring**
   - `85a9a11` (test) - Failing tests for admin handlers and auth middleware
   - `58feffb` (feat) - Admin handlers, AdminState, submission gate, SPA fallback, route wiring

## Files Created/Modified
- `server/auth.go` - SessionStore, CheckPassword, AuthMiddleware
- `server/admin.go` - HandleAdminLogin, HandleToggle, HandleDelete, HandleStats, HandleStatus
- `server/model.go` - AdminStats and LocationStat types
- `server/store.go` - Delete, GetStats, GetConfig, SetConfig, config table
- `server/sse.go` - SSEEvent, BroadcastEvent, refactored Broadcast/HandleSSE
- `server/handler.go` - Extended Handler struct, AdminState, submission closed-state check
- `server/middleware.go` - Added DELETE to CORS allowed methods
- `main.go` - ADMIN_PASSWORD flag, session store, admin state, admin routes, SPA fallback
- `server/auth_test.go` - Session and password unit tests (6 tests)
- `server/admin_test.go` - Admin handler integration tests (10 tests)
- `server/handler_test.go` - Updated setupTestHandler for new Handler signature
- `server/store_test.go` - Store extension tests (5 tests)

## Decisions Made
- Used `crypto/rand.Text()` (Go 1.24+) for session tokens -- provides 128+ bit entropy without manual hex encoding
- Used `crypto/subtle.ConstantTimeCompare` for password checks to prevent timing attacks
- AdminState uses in-memory mutex-protected boolean for fast reads on every form submission, backed by SQLite config table for restart survival
- SSE messages are pre-formatted in `BroadcastEvent` so the HandleSSE loop just writes raw bytes (no per-client formatting)
- SPA fallback checks if file exists in embedded FS before falling back to index.html -- avoids serving HTML for actual static assets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. ADMIN_PASSWORD environment variable must be set at runtime but this is documented in the flag definition.

## Next Phase Readiness
- All admin API endpoints are functional and tested
- Frontend admin panel (Plan 02) can consume all endpoints via fetch
- SSE event types ready for real-time admin panel updates
- SPA fallback enables /admin route for client-side routing

## Self-Check: PASSED

- All 12 files exist
- All 4 task commits verified (26cce55, d0dfc2b, 85a9a11, 58feffb)
- 36/36 tests passing
- go vet clean
- go build clean

---
*Phase: 03-admin-panel*
*Completed: 2026-03-22*
