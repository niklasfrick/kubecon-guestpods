---
phase: 1
slug: server-core-submission-form
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Go)** | `go test` (stdlib) with `net/http/httptest` |
| **Framework (Frontend)** | Vitest + @testing-library/preact |
| **Config file (Go)** | None — `go test ./...` works out of the box |
| **Config file (Frontend)** | `web/vitest.config.ts` (Wave 0) |
| **Quick run command** | `go test ./... && cd web && npx vitest run` |
| **Full suite command** | `go test -race -count=1 ./... && cd web && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... -count=1`
- **After every plan wave:** Run `go test -race -count=1 ./... && cd web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SUBM-01 | unit | `go test ./server -run TestQRCode -v` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SUBM-02 | unit | `go test ./server -run TestStaticServing -v` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SUBM-03 | unit | `go test ./server -run TestSubmitHandler -v` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | SUBM-04 | unit | `go test ./server -run TestSubmitValidation -v` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | SUBM-05 | unit | `go test ./server -run TestSubmitValidation -v` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | SUBM-06 | unit | `go test ./server -run TestSubmitHandler -v` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | SUBM-07 | unit | `go test ./server -run TestProfanityFilter -v` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFR-04 | smoke | `cd web && npx vite build && du -sk dist/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/handler_test.go` — covers SUBM-01 through SUBM-07
- [ ] `server/store_test.go` — covers SQLite persistence
- [ ] `web/vitest.config.ts` — Vitest configuration for Preact
- [ ] `web/src/components/__tests__/` — component test directory
- [ ] `Makefile` with `test` target combining Go and frontend tests

*Existing infrastructure covers none — greenfield project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile form loads < 2s on 4G | SUBM-02, INFR-04 | Network throttling needed | Chrome DevTools > Network > Slow 4G, load form URL, verify DOMContentLoaded < 2s |
| Emoji scale visual rendering | SUBM-05 | Visual check | Open form on mobile viewport, verify 5 emoji levels display horizontally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
