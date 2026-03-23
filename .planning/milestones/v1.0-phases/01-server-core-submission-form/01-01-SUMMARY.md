---
phase: 01-server-core-submission-form
plan: 01
subsystem: api
tags: [go, sqlite, sse, profanity-filter, qrcode, rest-api]

# Dependency graph
requires:
  - phase: none
    provides: "First plan -- greenfield project"
provides:
  - "Go HTTP server with REST API for submissions (POST /api/submissions)"
  - "SQLite persistence with WAL mode (server/store.go)"
  - "SSE broadcaster for real-time submission push (server/sse.go)"
  - "Profanity filter with go-away and false positive handling (server/profanity.go)"
  - "QR code PNG endpoint (GET /api/qr)"
  - "Health check endpoint (GET /api/health)"
  - "Embedded frontend asset serving via go:embed"
  - "CORS and logging middleware"
affects: [01-02, 02-visualization-engine, 03-admin-panel]

# Tech tracking
tech-stack:
  added: [modernc.org/sqlite, github.com/TwiN/go-away, github.com/skip2/go-qrcode]
  patterns: [SSE hub/broadcaster, WAL mode SQLite with single writer, Go 1.22+ method routing, dependency injection via Handler struct]

key-files:
  created:
    - main.go
    - embed.go
    - server/model.go
    - server/store.go
    - server/profanity.go
    - server/handler.go
    - server/sse.go
    - server/middleware.go
    - server/handler_test.go
    - server/store_test.go
    - Makefile
    - .gitignore
    - go.mod
    - go.sum
  modified: []

key-decisions:
  - "Used go:embed all:web/dist with .gitkeep placeholder for frontend asset embedding"
  - "SSE handler flushes headers immediately so clients connect without waiting for first event"
  - "Profanity checker does case-insensitive exact match against false positive names before go-away check"
  - "Used rune length (not byte length) for 30-char name limit to support Unicode names"

patterns-established:
  - "Handler struct with dependency injection (Store, SSEHub, ProfanityChecker, baseURL)"
  - "writeJSON helper for consistent JSON response formatting"
  - "responseWriter wrapper for status code capture in logging middleware"
  - "Test helper setupTestHandler creating temp SQLite store with t.TempDir()"
  - "httptest.NewServer for SSE tests to avoid race conditions"

requirements-completed: [SUBM-01, SUBM-02, SUBM-03, SUBM-04, SUBM-05, SUBM-06, SUBM-07]

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 1 Plan 1: Server Core Summary

**Go HTTP server with SQLite WAL-mode persistence, REST submission API, SSE broadcaster, profanity filter (go-away), and QR code generation -- 13 tests passing with race detector**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-20T20:32:34Z
- **Completed:** 2026-03-20T20:43:04Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Complete Go server with all API endpoints: submit (POST 201), health (GET 200), QR code (GET PNG), SSE stream
- SQLite data layer with WAL mode, busy_timeout=5000, MaxOpenConns(1), soft-delete support
- SSE hub/broadcaster with buffered channels, non-blocking broadcast, and immediate header flush
- Profanity filter wrapping go-away with false positive handling for common names (Dick, Fanny, etc.)
- 13 tests (9 handler + 4 store) passing with race detector enabled
- Makefile with dev/build/test/clean targets

## Task Commits

Each task was committed atomically:

1. **Task 1: Go server implementation** - `18a4d1c` (feat)
2. **Task 2: Server tests and Makefile** - `4dba097` (test)

## Files Created/Modified
- `go.mod` / `go.sum` - Go module with sqlite, go-away, go-qrcode dependencies
- `main.go` - Server entry point with flag/env config, route registration
- `embed.go` - go:embed directive for web/dist frontend assets
- `server/model.go` - SubmitRequest/Response types, validation, 249 country codes, homelab emojis
- `server/store.go` - SQLite data layer with WAL mode, Insert, GetAll, Close
- `server/profanity.go` - go-away wrapper with false positive name handling
- `server/handler.go` - HTTP handlers for submit, QR code, health
- `server/sse.go` - SSE hub with subscribe/unsubscribe/broadcast, streaming handler
- `server/middleware.go` - CORS and logging middleware with Flusher passthrough
- `server/handler_test.go` - 9 handler tests covering all endpoints and error cases
- `server/store_test.go` - 4 store tests covering insert, flags, get-all, soft-delete
- `Makefile` - dev, build, test-go, test-web, clean targets
- `.gitignore` - SQLite files, node_modules, web/dist, bin/
- `web/dist/.gitkeep` - Placeholder for embed directive

## Decisions Made
- Used `go:embed all:web/dist` (with `all:` prefix) so hidden files like .gitkeep are included
- Added immediate `flusher.Flush()` after setting SSE headers -- without this, HTTP clients hang waiting for first data before receiving response headers
- Used `rune` length for name validation to correctly handle multi-byte Unicode characters
- responseWriter wrapper implements `http.Flusher` interface so SSE streaming works through logging middleware

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SSE handler not flushing headers immediately**
- **Found during:** Task 2 (SSE test)
- **Issue:** SSE handler set headers but never flushed them before blocking on channel reads. HTTP clients would hang indefinitely waiting for headers until the first SSE event arrived.
- **Fix:** Added `flusher.Flush()` call immediately after setting SSE response headers
- **Files modified:** `server/sse.go`
- **Verification:** TestSSEStream passes with race detector, integration test confirms headers received immediately
- **Committed in:** `4dba097` (Task 2 commit)

**2. [Rule 1 - Bug] SSE test race condition on ResponseRecorder headers**
- **Found during:** Task 2 (initial test run)
- **Issue:** Using `httptest.NewRecorder()` with a goroutine caused data race -- test goroutine read headers while handler goroutine set them concurrently
- **Fix:** Switched to `httptest.NewServer` for the SSE test, which properly handles concurrent access
- **Files modified:** `server/handler_test.go`
- **Verification:** Race detector no longer reports issues
- **Committed in:** `4dba097` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were necessary for correctness. The SSE header flush is an actual production bug that would have affected real clients. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints operational and tested, ready for frontend integration (Plan 01-02)
- SSE broadcaster ready for visualization engine (Phase 2) to consume
- Store supports soft-delete for admin moderation (Phase 3)
- Embedded asset serving ready once web/dist is built by Plan 01-02

## Self-Check: PASSED

All 15 files verified present. Both commit hashes (18a4d1c, 4dba097) verified in git log.

---
*Phase: 01-server-core-submission-form*
*Completed: 2026-03-20*
