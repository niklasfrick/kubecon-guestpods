---
phase: 2
slug: visualization-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go testing (server) + manual visual verification (Canvas frontend) |
| **Config file** | none — no frontend test framework |
| **Quick run command** | `go test ./server/ -run TestHandleGetSubmissions -v` |
| **Full suite command** | `go test ./... -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... -v` + manual browser check at `http://localhost:5173/viz`
- **After every plan wave:** Full Go test suite + manual visual verification with 50+ test pods
- **Before `/gsd:verify-work`:** Go tests green + 500-pod DevTools performance profile showing <16ms frame time
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VIZZ-01 | manual | Browser DevTools: Network tab SSE stream | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | VIZZ-02 | manual | Visual inspection: pods with same country in same cluster | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | VIZZ-03 | manual | Visual inspection: labels show flag + ns/CODE format | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | VIZZ-04 | manual | Visual inspection: new pods scale in with glow | N/A | ⬜ pending |
| 02-01-05 | 01 | 1 | VIZZ-05 | manual | Visual inspection: pods are colored rounded rectangles | N/A | ⬜ pending |
| 02-01-06 | 01 | 1 | VIZZ-06 | manual | Visual inspection: emoji and truncated name visible | N/A | ⬜ pending |
| 02-01-07 | 01 | 1 | VIZZ-07 | manual | Visual inspection: pods don't overlap, clusters cohesive | N/A | ⬜ pending |
| 02-01-08 | 01 | 1 | VIZZ-08 | manual | Visual inspection: top-left shows "X pods · Y namespaces" | N/A | ⬜ pending |
| 02-01-09 | 01 | 1 | VIZZ-09 | manual | Mouse hover: expanded card appears | N/A | ⬜ pending |
| 02-01-10 | 01 | 1 | VIZZ-10 | manual-with-script | DevTools Performance profile while adding 500 test pods | N/A | ⬜ pending |
| 02-W0-01 | W0 | 0 | -- | unit | `go test ./server/ -run TestHandleGetSubmissions -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/handler_test.go` — add `TestHandleGetSubmissions` for GET /api/submissions endpoint
- [ ] No frontend test infrastructure (Canvas visualization is primarily visual; manual testing is appropriate for this phase)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE events received and parsed into pod nodes | VIZZ-01 | Browser SSE stream requires live server + client | Open DevTools Network tab, submit form, verify SSE event appears and pod renders |
| Pods grouped by country_code into clusters | VIZZ-02 | Visual spatial arrangement not automatable | Submit 3+ pods with same country, verify they cluster together |
| Namespace labels rendered with K8s naming | VIZZ-03 | Text rendering on Canvas | Verify labels show flag emoji + ns/CODE format |
| Entrance animation (scale + glow) | VIZZ-04 | Animation timing is visual | Submit new pod, observe scale-in with glow effect |
| Rounded-rect K8s pod visual | VIZZ-05 | Canvas shape rendering | Verify pods are colored rounded rectangles |
| Pod displays emoji + name | VIZZ-06 | Canvas text/emoji rendering | Verify each pod shows selected emoji and truncated name |
| D3 force layout arranges organically | VIZZ-07 | Spatial layout quality | Verify pods don't overlap and clusters remain cohesive |
| Stats overlay shows counts | VIZZ-08 | DOM overlay on Canvas | Verify top-left shows "X pods · Y namespaces" |
| Hover shows full details | VIZZ-09 | Mouse interaction on Canvas | Hover over pod, verify expanded card with full details |
| 500 pods no frame drops | VIZZ-10 | Performance profiling | Run DevTools Performance profile while adding 500 test pods, verify <16ms frame time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
