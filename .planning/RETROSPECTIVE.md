# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-23
**Phases:** 4 | **Plans:** 12

### What Was Built
- Go server with SQLite persistence, REST API, SSE broadcaster, profanity filter, QR code
- Preact mobile-first submission form (14.8KB gzipped) with country dropdown and homelab emoji grid
- D3 force-based K8s cluster visualization with Canvas rendering, namespace clustering, pan/zoom
- Admin panel with session auth, submission toggle, single + bulk delete, real-time stats
- Multi-stage Dockerfile (distroless), Helm chart (Gateway API, cert-manager, PVC), k6 load tests

### What Worked
- **Hard dependency chain as phase order** — server → viz → admin → deploy prevented blocked phases and produced testable artifacts at each step
- **Coarse 4-phase structure** — for a focused, single-purpose app, 4 phases was the right granularity; finer slicing would have added overhead without benefit
- **Canvas over SVG** — correct call for 500 animated pods; no performance issues discovered during development
- **SSE over WebSockets** — simpler implementation, no library needed, worked perfectly with keep-alive ticker for proxy compatibility
- **Single binary with embedded frontend** — dramatically simplified deployment (one container, zero config)
- **Gap closure plans (02-04, 02-05)** — inserting focused fix-it plans after the core engine was done kept momentum while addressing real issues

### What Was Inefficient
- **Phase 3 broke Phase 1 confirmation flow** — app.tsx routing rewrite made Confirmation.tsx dead code, caught only at milestone audit. Cross-phase regression testing would have caught this at Phase 3 completion
- **VizPage SSE state handler left undefined** — minor integration gap between Phase 2 and Phase 3 that degraded gracefully but wasn't clean
- **Phase 4 plans marked incomplete in ROADMAP.md** — plans were fully executed but the roadmap checkboxes weren't updated, causing confusion during milestone audit

### Patterns Established
- **go:embed all:web/dist** — Vite builds into web/dist, Go embeds for single-binary serving
- **modernc.org/sqlite** — pure Go SQLite driver, no CGO needed, compatible with distroless
- **Preact Signals** — lightweight reactivity for form/app state without framework overhead
- **D3 force + Canvas 2D** — effective pattern for animated node visualizations at scale
- **SSE keep-alive ticker** — 30s interval prevents proxy/CDN idle timeouts
- **existingSecret pattern** — Helm chart references external Secret for sensitive values

### Key Lessons
1. **Cross-phase integration needs explicit verification** — Phase 3 silently broke Phase 1's confirmation flow because there was no integration check between phases
2. **Milestone audit before archival is essential** — the audit caught a real regression (SUBM-06) that would have shipped as a known bug without it
3. **Canvas + D3-force is the right stack for live node visualizations** — SVG would have hit performance walls; the Canvas approach scaled to 500 pods without issues
4. **Single-purpose apps benefit from coarse phases** — 4 phases in 3 days; more granular planning would have been overhead

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 12 | Initial delivery — established base patterns |

### Top Lessons (Verified Across Milestones)

1. Cross-phase regression testing catches integration issues early
2. Milestone audit is a valuable gate before archival
