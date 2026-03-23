# Milestones

## v1.0 MVP (Shipped: 2026-03-23)

**Phases:** 4 | **Plans:** 12 | **LOC:** 5,261 (Go + TypeScript + CSS)
**Timeline:** 3 days (2026-03-20 → 2026-03-23)
**Git range:** initial commit → caf1bac

**Delivered:** Live KubeCon audience participation app — attendees scan a QR code, submit their name/location/emoji, and appear as animated pods in a real-time K8s cluster visualization on the big screen.

**Key accomplishments:**
- Go server with SQLite, REST API, SSE broadcaster, profanity filter, and QR code generation
- Preact mobile-first submission form with country dropdown and homelab emoji grid (14.8KB gzipped)
- D3 force-based K8s cluster visualization with Canvas rendering, namespace clustering, pan/zoom, and entrance animations
- Admin panel with session auth, submission toggle, moderation (single + bulk delete), and real-time stats
- Multi-stage Dockerfile with distroless runtime, SSE keep-alive ticker, and graceful shutdown
- Helm chart with Gateway API, cert-manager TLS, PVC persistence, and k6 load test for 500 concurrent users

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---

