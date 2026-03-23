---
phase: 4
slug: deployment-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go testing (stdlib) + k6 (load testing) + Helm lint |
| **Config file** | None for Go tests; k6 scripts in `loadtest/` |
| **Quick run command** | `go test ./... -count=1` |
| **Full suite command** | `go test -race -count=1 ./... && helm template chart/ && docker build -t guestbook:test .` |
| **Estimated runtime** | ~30 seconds (Go tests ~5s, helm template ~2s, docker build ~20s) |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... -count=1`
- **After every plan wave:** Run `go test -race -count=1 ./... && helm template chart/ && docker build -t guestbook:test .`
- **Before `/gsd:verify-work`:** Full suite must be green + k6 load test against deployed instance
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INFR-03 | unit | `go test ./server/ -run TestSSEKeepalive -count=1` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INFR-03 | unit | `go test ./... -run TestGracefulShutdown -count=1` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | INFR-01 | smoke | `docker build -t guestbook:test .` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | INFR-01 | unit | `helm template chart/` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | INFR-01 | smoke | `act -j build-and-push --dryrun` (or manual tag push) | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | INFR-03 | load | `k6 run loadtest/submissions.js` | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 2 | INFR-02 | integration | Manual: `kubectl delete pod`, verify data | Manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/sse_test.go` — SSE keep-alive test for INFR-03
- [ ] `loadtest/submissions.js` — k6 load test script for INFR-03
- [ ] Helm template render validation (`helm template chart/`) — covers INFR-01 chart correctness
- [ ] Docker build smoke test — covers INFR-01 containerization

*Existing infrastructure: Go test framework already in use, `/api/health` endpoint exists for probes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Data persists across pod restart | INFR-02 | Requires live K8s cluster with PVC | 1. Submit entries via UI 2. `kubectl delete pod <name>` 3. Wait for pod restart 4. Verify entries still present |
| SSE soak test (10+ min) | INFR-03 | Long-running real-time connection test | 1. Open SSE endpoint in browser/curl 2. Wait 10+ minutes 3. Verify connection stays open, no drops |
| Full path through Cloudflare | INFR-03 | Requires live DNS + Cloudflare proxy | 1. Run k6 against production URL 2. Verify responses come through Cloudflare (CF headers) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
