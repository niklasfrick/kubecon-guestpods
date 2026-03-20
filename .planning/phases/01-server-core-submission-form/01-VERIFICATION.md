---
phase: 01-server-core-submission-form
verified: 2026-03-20T21:07:08Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 1: Server Core + Submission Form Verification Report

**Phase Goal:** Build the Go server backend and Preact submission form frontend for the KubeCon Guestbook
**Verified:** 2026-03-20T21:07:08Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/submissions with valid data returns 201 and persists to SQLite | VERIFIED | `server/handler.go:76` returns `http.StatusCreated`; `server/store.go:60` inserts to SQLite; `TestSubmitHandler_ValidSubmission` asserts 201 + ID > 0 |
| 2 | POST /api/submissions with profane name returns 422 with user-friendly error | VERIFIED | `server/handler.go:52` returns `http.StatusUnprocessableEntity`; `TestSubmitHandler_ProfaneName` asserts 422 + "That name wasn't accepted" |
| 3 | POST /api/submissions with invalid country code or homelab level returns 400 | VERIFIED | `server/model.go:99` Validate() returns ErrorResponse; `server/handler.go:45` returns 400; tests: `TestSubmitHandler_InvalidCountry`, `TestSubmitHandler_InvalidHomelabLevel` |
| 4 | GET /api/submissions/stream returns SSE stream and broadcasts new submissions | VERIFIED | `server/sse.go:54` HandleSSE sets `text/event-stream` header, flushes immediately, broadcasts `event: submission\ndata: %s\n\n`; `TestSSEStream` confirms Content-Type |
| 5 | GET /api/qr returns a valid PNG image | VERIFIED | `server/handler.go:84` calls `qrcode.Encode`, sets `Content-Type: image/png`; `TestQRCode` verifies 200 + PNG magic bytes `0x89504E47` |
| 6 | GET /api/health returns 200 | VERIFIED | `server/handler.go:97` returns `{"status":"ok"}` with 200; `TestHealth` confirms |

### Observable Truths (Plan 01-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Attendee sees a single-page form with name input, country dropdown, homelab scale, and submit button | VERIFIED | `web/src/components/SubmissionForm.tsx` renders TextInput, CountrySelect, HomelabScale, SubmitButton in `.card` |
| 8 | Country dropdown shows European countries first under 'Europe' optgroup, then all others under 'Other countries' | VERIFIED | `web/src/components/CountrySelect.tsx:35-48` renders `<optgroup label="Europe">` and `<optgroup label="Other countries">` using `europeanCountries`/`otherCountries` |
| 9 | Tapping a homelab emoji shows its description below the scale | VERIFIED | `web/src/components/HomelabScale.tsx:43` renders `<p class="scale-description{selected ? ' visible' : ''}">` with selected level label |
| 10 | Submit button says 'kubectl apply' and is disabled until all fields are filled | VERIFIED | `web/src/components/SubmitButton.tsx:19` renders "kubectl apply"; `web/src/components/SubmissionForm.tsx:132-135` passes `disabled={!allFieldsValid}` |
| 11 | Submitting valid data replaces the form with a 'Pod deployed!' confirmation showing emoji, name, namespace | VERIFIED | `web/src/app.tsx:22-26` switches on `formState.value === "success"`; `web/src/components/Confirmation.tsx:12-17` renders "Pod deployed!", emoji+name, `ns/{country_code}` |
| 12 | Confirmation shows 'Status: Running' and 'Look up at the screen to find yourself!' | VERIFIED | `web/src/components/Confirmation.tsx:19-25` renders both strings verbatim |
| 13 | Frontend bundle is under 50KB gzipped | VERIFIED | JS: 13,198 bytes gzipped, CSS: 1,650 bytes gzipped, total: 14,848 bytes — 71% under the 51,200-byte limit |

**Score:** 13/13 truths verified

---

### Required Artifacts (Plan 01-01)

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `main.go` | Server entry point, config, startup | Yes | 59 lines, `func main()`, flags, route registration | Routes to all handlers via mux | VERIFIED |
| `server/model.go` | Submission struct, validation, homelab level mapping | Yes | 114 lines, all 4 exported types, Validate(), countryCodeToFlag(), HomelabEmojis, 249 country codes | Used by handler.go and store.go | VERIFIED |
| `server/store.go` | SQLite data access layer with WAL mode | Yes | 123 lines, WAL/busy_timeout/MaxOpenConns(1), Insert(), GetAll(), Close() | Used by handler.go | VERIFIED |
| `server/handler.go` | HTTP handlers for submit, QR, health | Yes | 111 lines, HandleSubmit/HandleQRCode/HandleHealth, hub.Broadcast, store.Insert | Registered in main.go via mux.HandleFunc | VERIFIED |
| `server/sse.go` | SSE hub with subscribe/unsubscribe/broadcast | Yes | 83 lines, SSEHub struct, all 3 methods, HandleSSE with text/event-stream + X-Accel-Buffering | Registered in main.go; Broadcast called from handler.go | VERIFIED |
| `server/profanity.go` | Profanity filter wrapping go-away | Yes | 39 lines, ProfanityChecker wrapping goaway, false positive names list, IsProfane() | Used by handler.go in HandleSubmit | VERIFIED |
| `server/middleware.go` | CORS and logging middleware | Yes | 53 lines, CORSMiddleware + LoggingMiddleware + Flusher passthrough | Applied in main.go as `LoggingMiddleware(CORSMiddleware(mux))` | VERIFIED |
| `server/handler_test.go` | Handler tests covering all API endpoints | Yes | 264 lines (min 80) — 9 test functions | Uses setupTestHandler with real SQLite, httptest | VERIFIED |
| `server/store_test.go` | Store tests covering CRUD operations | Yes | 101 lines (min 40) — 4 test functions | Uses newTestStore with t.TempDir() | VERIFIED |

### Required Artifacts (Plan 01-02)

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `web/src/app.tsx` | Root component managing form vs confirmation state | Yes | `formState` signal, `submissionData` signal, localStorage check, App() branching | Imports and renders SubmissionForm + Confirmation | VERIFIED |
| `web/src/components/SubmissionForm.tsx` | Main form with all fields | Yes | 141 lines, handleSubmit, client-side validation, submitEntry call, error handling, "kubectl apply" | Imports submitEntry from api.ts; uses formState/submissionData signals | VERIFIED |
| `web/src/components/CountrySelect.tsx` | Country dropdown with optgroups | Yes | 57 lines, two optgroups "Europe"/"Other countries" | Imports europeanCountries/otherCountries from data/countries | VERIFIED |
| `web/src/components/HomelabScale.tsx` | 5-level homelab emoji scale | Yes | 48 lines, all 5 levels with exact labels from spec, scale-description visibility toggle | Rendered by SubmissionForm | VERIFIED |
| `web/src/components/Confirmation.tsx` | Post-submission confirmation screen | Yes | 29 lines, "Pod deployed!", ns/{code}, "Status: Running", CTA | Rendered by app.tsx on success state | VERIFIED |
| `web/src/data/countries.ts` | ISO 3166-1 country list with codes | Yes | 248 country entries (min 200), europeanCodes set, sortedCountries, europeanCountries, otherCountries | Imported by CountrySelect | VERIFIED |
| `web/src/style.css` | Mobile-first dark theme CSS | Yes | `#0F172A`, `#38BDF8`, `prefers-reduced-motion`, 570+ lines | Imported by main.tsx | VERIFIED |
| `web/src/api.ts` | Fetch wrapper for submission POST | Yes | 55 lines, `fetch("/api/submissions")`, SubmissionError class, typed request/response | Imported by SubmissionForm | VERIFIED |

---

### Key Link Verification

#### Plan 01-01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `server/handler.go` | `server/store.go` | Store dependency injection | WIRED | `h.store.Insert(req)` at line 60; `h.store` field injected via `NewHandler` |
| `server/handler.go` | `server/sse.go` | SSEHub broadcast after insert | WIRED | `h.hub.Broadcast(data)` at line 73 after successful insert |
| `server/handler.go` | `server/profanity.go` | Name check before persistence | WIRED | `h.checker.IsProfane(req.Name)` at line 51, before store.Insert |
| `main.go` | `server/handler.go` | Route registration on ServeMux | WIRED | `mux.HandleFunc("POST /api/submissions", handler.HandleSubmit())` and 3 more routes |

#### Plan 01-02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `web/src/components/SubmissionForm.tsx` | `web/src/api.ts` | Form onSubmit calls submitEntry | WIRED | `submitEntry({ name, country_code, homelab_level })` at line 56 inside handleSubmit |
| `web/src/app.tsx` | `web/src/components/Confirmation.tsx` | State transition on successful submission | WIRED | `formState.value === "success"` at line 23 renders `<Confirmation data={...} />` |
| `web/src/components/CountrySelect.tsx` | `web/src/data/countries.ts` | Import country list for dropdown options | WIRED | `import { europeanCountries, otherCountries } from "../data/countries"` at line 1 |
| `web/vite.config.ts` | Go server | Dev proxy for /api/* requests | WIRED | `proxy: { "/api": { target: "http://localhost:8080" } }` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUBM-01 | 01-01 | Attendee can access guestbook via QR code on a slide | SATISFIED | `GET /api/qr` endpoint generates PNG via go-qrcode; `server/handler.go:84`; configurable `base-url` flag in `main.go:16` |
| SUBM-02 | 01-01, 01-02 | Attendee can access via short memorable URL | SATISFIED | Server accepts `--base-url` / `BASE_URL` env var; frontend served at `/` from embedded assets; single binary ready for deployment at any URL |
| SUBM-03 | 01-01, 01-02 | Attendee can submit name on mobile-friendly form | SATISFIED | `web/src/components/SubmissionForm.tsx` with `web/src/components/TextInput.tsx`; 400px max-width card, 48px touch targets, 16px font (no iOS zoom), `name` input with maxLength=30 |
| SUBM-04 | 01-01, 01-02 | Attendee can select location from pre-defined dropdown | SATISFIED | `web/src/components/CountrySelect.tsx` with 248 countries; native `<select>` with optgroups; matches `ValidCountryCodes` in server/model.go |
| SUBM-05 | 01-01, 01-02 | Attendee can select homelab emoji from curated grid | SATISFIED | `web/src/components/HomelabScale.tsx` with 5 emoji buttons; REQUIREMENTS.md description says "15-25 themed emojis" but CONTEXT.md (locked decision) specifies 5-level scale — implemented as specified in locked context |
| SUBM-06 | 01-01, 01-02 | Attendee sees "You're now a pod in the cluster!" confirmation | SATISFIED | `web/src/components/Confirmation.tsx`: "Pod deployed!", emoji+name, `ns/{country_code}`, "Status: Running", "Look up at the screen to find yourself!" |
| SUBM-07 | 01-01 | Name field filtered against profanity blocklist | SATISFIED | `server/profanity.go` wraps go-away with false positive handling; `server/handler.go:51` checks before persistence; returns 422 with user-friendly message |
| INFR-04 | 01-02 | Submission form loads under 2 seconds on 4G | SATISFIED | Bundle 14,848 bytes gzipped total (JS 13,198 + CSS 1,650); 71% under 50KB target; Preact chosen for minimal runtime |

**Note on SUBM-05:** REQUIREMENTS.md says "curated grid of 15-25 themed emojis" but the locked context (01-CONTEXT.md) specified a 5-level homelab maturity scale with 5 emojis. The implementation follows the locked context. This is a requirements-to-context alignment issue, not an implementation bug.

---

### Anti-Patterns Found

No blockers or stubs detected across all phase files. The single grep hit for "placeholder" was the HTML input's `placeholder="Enter your name"` attribute — correct HTML semantics, not a code stub.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

---

### Human Verification Required

#### 1. Mobile Form Rendering and Full Submission Flow

**Test:** Open `http://localhost:8080` (run `./bin/guestbook`) on a phone or Chrome DevTools at 375px width. Fill in name, country, homelab level. Tap "kubectl apply".
**Expected:** Dark card form renders, "kubectl apply" button disabled until all fields filled, shows "Deploying..." spinner on submit, transitions to "Pod deployed!" confirmation with emoji, name, `ns/XX`, green "Status: Running" dot, and italic CTA.
**Why human:** Visual layout fidelity, touch interaction, spinner animation, and confirmation screen appearance cannot be verified programmatically.

#### 2. localStorage Persistence

**Test:** Submit the form successfully, then hard-refresh the page.
**Expected:** Confirmation screen shows immediately without the form — localStorage persists the submission data.
**Why human:** Browser session state cannot be verified by grep.

#### 3. Profanity Error UX on Mobile

**Test:** Clear localStorage, reload, enter a profane name, select valid country and homelab level, tap "kubectl apply".
**Expected:** Form re-enables, field-level error appears on the name input reading "That name wasn't accepted. Try a different one." (no banner).
**Why human:** Field-level error rendering and form recovery behavior require visual confirmation.

---

### Build Verification

| Check | Result |
|-------|--------|
| `go build ./...` | PASS — builds without errors |
| `go test -race -count=1 ./...` | PASS — 13 tests pass with race detector (9 handler + 4 store) |
| `bin/guestbook` binary exists | PASS — 15MB single binary |
| Frontend bundle JS gzipped | 13,198 bytes |
| Frontend bundle CSS gzipped | 1,650 bytes |
| Total bundle gzipped | 14,848 bytes (INFR-04: under 51,200) |
| 248 countries in countries.ts | PASS (min 200 required) |

---

## Summary

Phase 1 goal is fully achieved. The Go backend server is complete with all required endpoints (POST /api/submissions, GET /api/submissions/stream, GET /api/qr, GET /api/health), SQLite WAL persistence, SSE broadcasting, profanity filtering, and 13 passing tests with race detector. The Preact frontend is complete with all 7 components, dark K8s theme, European-priority country dropdown, 5-level homelab scale, K8s-themed submit flow, and localStorage persistence. The full pipeline is wired end-to-end: form submits to API, API persists and broadcasts via SSE, confirmation screen displays response data. Bundle is 14.8KB gzipped — well under the 50KB INFR-04 target. All 8 phase requirements are satisfied.

---

_Verified: 2026-03-20T21:07:08Z_
_Verifier: Claude (gsd-verifier)_
