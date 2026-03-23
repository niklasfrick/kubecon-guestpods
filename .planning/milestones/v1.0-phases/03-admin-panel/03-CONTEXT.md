# Phase 3: Admin Panel - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Presenter control surface for managing the guestbook during and after the live talk. Open/close submissions with a toggle, moderate content by deleting individual pods, view live stats, and transition to a read-only post-talk artifact. The admin panel is a separate authenticated route within the same app.

</domain>

<decisions>
## Implementation Decisions

### Authentication & access
- Simple password login page at `/admin` — shared secret set via environment variable
- Cookie-based session — persists across browser refreshes, no re-entering password mid-talk
- Admin API endpoints (toggle, delete) are also protected by the same session cookie — not just the UI
- Route pattern: `/admin` for login, `/admin` dashboard after auth (consistent with existing `/viz` pattern)

### Panel layout & stats
- Compact single-screen "control bar" layout — everything visible at once, no tabs or scrolling for key actions
- Big toggle button at top, stats in the middle, submission list at bottom
- Stats: total pods, namespace count, top 3-5 locations by count — numbers only, no charts
- Stats update in real-time via the existing SSE stream (same infrastructure as viz)
- K8s-themed language throughout — consistent with Phase 1 and 2 decisions (e.g., "pods" not "submissions")

### Moderation workflow
- Inline delete button (✗) on each submission row in the list
- Delete requires a confirmation dialog ("Delete this pod?") — two clicks for safety
- Soft-delete in DB (column already exists in schema) — `deleted = TRUE`
- Deletion broadcast via new SSE event type (e.g., `event: deletion` with pod ID)
- Viz removes the pod instantly on receiving the deletion event (no fade animation)
- Submission list is reverse-chronological (newest first), no search or filtering
- New submissions appear at the top of the list in real-time via SSE — live feed for reactive moderation

### Read-only transition
- Toggle button flips between CLOSE and REOPEN — admin can reopen submissions if needed
- Open/closed state stored in-memory for fast reads (checked on every form submission), persisted to a config table in SQLite for restart survival
- When closed: form URL redirects to /viz (already implemented in Phase 1 — server returns 403, frontend redirects)
- Visualization stays exactly the same when closed — no banner, no frozen animations. The viz IS the artifact
- Admin panel remains fully functional when closed (stats, list, moderation, reopen toggle)

### Claude's Discretion
- Admin panel CSS styling and dark/light theme
- Session cookie implementation details (expiry, secure flags)
- Config table schema for open/closed state
- SSE deletion event payload format
- Exact K8s-themed copy for toggle button states and panel headings
- How to serve the admin panel (embedded in same Preact app or separate)
- Password hashing approach (bcrypt, argon2, or plain comparison for env var secret)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in the decisions above and in `.planning/REQUIREMENTS.md` (ADMN-01 through ADMN-05).

### Prior phase context
- `.planning/phases/01-server-core-submission-form/01-CONTEXT.md` — K8s-themed language decisions, closed-state redirect to /viz, tech stack (Go + Preact + SQLite)
- `.planning/phases/02-visualization-engine/02-CONTEXT.md` — SSE event format (`event: submission`), pod visual design, namespace label format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/sse.go` — SSEHub with Subscribe/Unsubscribe/Broadcast; extend with new event types for deletion
- `server/store.go` — `deleted BOOLEAN` column already in schema; `GetAll()` already filters `WHERE deleted = FALSE`
- `server/handler.go` — Handler struct with dependency injection pattern (store, hub, checker, baseURL)
- `server/middleware.go` — CORS and Logging middleware; add auth middleware in same pattern
- `web/src/api.ts` — TypeScript interfaces (SubmitResponse, ErrorResponse); 403 → redirect to /viz already implemented
- `web/src/app.tsx` — Path-based routing (`/viz` renders VizPage); extend with `/admin` route

### Established Patterns
- Go 1.22+ method patterns on mux (e.g., `"POST /api/submissions"`)
- Preact signals for state management (`@preact/signals`)
- Middleware chain: CORS → Logging → mux (add auth middleware)
- Embedded frontend via `embed.go` — static assets served from `web/dist`
- Single Go binary with all assets embedded

### Integration Points
- `main.go` mux — add admin API routes (toggle, delete, stats, auth)
- SSE hub — broadcast deletion events alongside submission events
- Store — add Delete method (soft-delete), add config table for open/closed state, add stats queries (count by country)
- Form submission handler — check open/closed state, return 403 when closed

</code_context>

<specifics>
## Specific Ideas

- The admin panel should feel like a "kubectl dashboard" — compact, functional, K8s-themed language
- Toggle is the most important control — it needs to be the biggest, most prominent element (used under stage pressure)
- Live feed of submissions enables reactive moderation — presenter sees names as they arrive and can delete inappropriate ones before anyone on the viz screen notices
- The confirmation dialog on delete is a safety net for stage nerves — one mis-tap shouldn't delete a pod

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-admin-panel*
*Context gathered: 2026-03-22*
