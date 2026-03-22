---
phase: 3
slug: admin-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go testing (stdlib) + httptest |
| **Config file** | None needed -- Go convention |
| **Quick run command** | `go test ./server/ -count=1 -run TestAdmin -v` |
| **Full suite command** | `go test ./server/ -count=1 -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./server/ -count=1 -short`
- **After every plan wave:** Run `go test ./server/ -count=1 -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ADMN-05 | unit | `go test ./server/ -run TestAuth -v` | No -- W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ADMN-01 | unit | `go test ./server/ -run TestToggle -v` | No -- W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | ADMN-03 | unit | `go test ./server/ -run TestDelete -v` | No -- W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | ADMN-02 | unit | `go test ./server/ -run TestStats -v` | No -- W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | ADMN-04 | unit | `go test ./server/ -run TestSubmitWhenClosed -v` | No -- W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/admin_test.go` — stubs for ADMN-01 (toggle), ADMN-02 (stats), ADMN-03 (delete), ADMN-04 (closed state)
- [ ] `server/auth_test.go` — stubs for ADMN-05 (session creation, validation, middleware, password check)
- [ ] Extend `server/store_test.go` — `Delete()`, `GetStats()`, `GetConfig()`, `SetConfig()` store methods
- [ ] Extend `setupTestHandler` in `handler_test.go` — include session store and admin password

*Existing Go test infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile form reflects closed state in real-time | ADMN-01 | Requires browser + SSE | Open mobile form, toggle closed in admin, verify form shows closed message |
| Deleted pod disappears from visualization | ADMN-03 | Requires browser + SSE + D3 | Open viz, delete entry in admin, verify pod removal animates |
| Read-only mode preserves as lasting artifact | ADMN-01 | UX verification | Close submissions, verify guestbook remains visitable with all data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
