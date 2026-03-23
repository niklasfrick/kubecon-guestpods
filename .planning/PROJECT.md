# KubeCon Guestbook

## What This Is

A live KubeCon audience participation app: attendees scan a QR code, submit their name, location, and a homelab emoji, and appear as animated "pods" in a real-time Kubernetes-style cluster visualization — grouped into namespace clusters by location. Built as a single Go binary serving a Preact frontend, deployable on Niklas's homelab K8s cluster.

## Core Value

Attendees see themselves appear in real-time as pods in a K8s cluster visualization, creating a shared interactive moment during the talk.

## Requirements

### Validated

- ✓ Attendees can submit their name, location, and select a homelab emoji — v1.0
- ✓ Submissions appear in real-time as animated pods on the visualization screen — v1.0
- ✓ Pods are grouped into namespace clusters by attendee location — v1.0
- ✓ New pods animate in smoothly when submissions arrive — v1.0
- ✓ Visualization handles 100-500 concurrent attendees — v1.0 (k6 validated 500 concurrent)
- ✓ QR code and short URL displayed for attendee access — v1.0
- ✓ Attendees access a mobile-friendly submission form — v1.0 (14.8KB gzipped, loads <2s on 4G)
- ✓ Admin panel with submission open/close toggle — v1.0
- ✓ Admin panel shows stats (total submissions, submissions over time) — v1.0
- ✓ Admin panel includes moderation capabilities — v1.0 (single + bulk delete)
- ✓ Guestbook remains visitable after the talk (read-only once submissions closed) — v1.0
- ✓ Data persists so the guestbook is a lasting artifact of the talk — v1.0 (PVC-backed SQLite)

### Active

(None — all v1 requirements validated)

### Out of Scope

- Authentication/login for attendees — frictionless entry is key
- Chat or messaging between attendees — it's a guestbook, not a chat room
- Mobile app — web-only, accessed via QR/URL
- Multi-event support — built for this one talk
- Free-text messages / comments — content moderation risk during live talk
- Gamification / leaderboard — undermines inclusive "we're all in this cluster" vibe

## Context

Shipped v1.0 with 5,261 LOC across Go + TypeScript + CSS.
Tech stack: Go 1.24 (net/http, modernc.org/sqlite), Preact + Signals, D3-force, Canvas 2D, Vite, Helm, Gateway API.
Single binary serves both API and frontend via go:embed.
Deployment: multi-stage Dockerfile with distroless runtime, Helm chart with PVC + cert-manager TLS.

## Constraints

- **Hosting**: Must run on Niklas's homelab Kubernetes cluster — containerized and K8s-deployable
- **Scale**: Handle 100-500 concurrent users submitting within a short window (end of talk rush)
- **Real-time**: Sub-second update latency for the live visualization
- **Mobile-first**: Submission form must work well on phones (primary attendee device)
- **Reliability**: Must work flawlessly during the live talk — no second chances

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| K8s-style namespace clustering by location | Maps the talk's theme directly into the visualization | ✓ Good — visually compelling, audiences get the metaphor |
| Homelab emoji selector instead of free-text | Fun, visual, prevents inappropriate content | ✓ Good — curated grid eliminates moderation risk |
| Smooth animation over terminal-style output | More visually impressive on stage for a large audience | ✓ Good — D3 force + Canvas delivers smooth 60fps |
| Admin panel over CLI-only controls | Easier to manage during a live talk under pressure | ✓ Good — single-button toggle, at-a-glance stats |
| Canvas over SVG for visualization | 500 animated elements on unknown projector hardware | ✓ Good — handles 500 pods without frame drops |
| SSE over Socket.IO for real-time | Simpler, works behind standard proxies, server-to-client push | ✓ Good — reliable with keep-alive ticker |
| Coarse 4-phase structure | Hard dependency chain: server → viz → admin → deploy | ✓ Good — clear build order, 3-day delivery |
| Single Go binary with embedded frontend | Simplest deployment, no separate web server | ✓ Good — single container, zero config |
| SQLite with modernc.org pure Go driver | No CGO, single-file persistence, PVC-friendly | ✓ Good — CGO_ENABLED=0 with distroless |
| Preact over React | Tiny bundle for mobile-first form (14.8KB gzipped total) | ✓ Good — well under 2s load target |

---
*Last updated: 2026-03-23 after v1.0 milestone*
