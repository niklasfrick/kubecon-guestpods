# KubeCon Guestbook

## What This Is

An interactive web application that serves as a live guestbook for Niklas's talk at KubeCon/CloudNativeCon Europe 2026. Attendees sign in with their name, location, and a homelab emoji, and appear as animated "pods" in a Kubernetes-style cluster visualization — grouped into namespace clusters by location. The app runs on Niklas's own homelab Kubernetes cluster, perfectly embodying the talk's theme of falling in love with tech through tinkering with containers and K8s.

## Core Value

Attendees see themselves appear in real-time as pods in a K8s cluster visualization, creating a shared interactive moment during the talk.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Attendees can submit their name, location, and select a homelab emoji
- [ ] Submissions appear in real-time as animated pods on the visualization screen
- [ ] Pods are grouped into namespace clusters by attendee location
- [ ] New pods animate in smoothly when submissions arrive
- [ ] Visualization handles 100-500 concurrent attendees
- [ ] QR code and short URL displayed for attendee access
- [ ] Attendees access a mobile-friendly submission form
- [ ] Admin panel with submission open/close toggle
- [ ] Admin panel shows stats (total submissions, submissions over time)
- [ ] Admin panel includes moderation capabilities
- [ ] Guestbook remains visitable after the talk (read-only once submissions closed)
- [ ] Data persists so the guestbook is a lasting artifact of the talk

### Out of Scope

- Authentication/login for attendees — frictionless entry is key
- Chat or messaging between attendees — it's a guestbook, not a chat room
- Mobile app — web-only, accessed via QR/URL
- Multi-event support — built for this one talk

## Context

- **The talk:** Niklas's KubeCon/CloudNativeCon Europe 2026 talk about rediscovering passion for tech through homelab tinkering with containers and Kubernetes, and building a career as a platform engineer
- **The moment:** At the end of the talk, Niklas shows a QR code + URL. Attendees open it on their phones, enter their info, and watch themselves appear as pods in a live K8s cluster visualization on the big screen
- **The metaphor:** Each attendee is a pod. Locations become namespaces. The whole audience becomes a cluster — mirroring the K8s concepts from the talk
- **After the talk:** The guestbook stays live as a read-only artifact. Niklas can close submissions when ready

## Constraints

- **Hosting**: Must run on Niklas's homelab Kubernetes cluster — the app should be containerized and K8s-deployable
- **Scale**: Handle 100-500 concurrent users submitting within a short window (end of talk rush)
- **Real-time**: Sub-second update latency for the live visualization
- **Mobile-first**: Submission form must work well on phones (primary attendee device)
- **Reliability**: Must work flawlessly during the live talk — no second chances

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| K8s-style namespace clustering by location | Maps the talk's theme directly into the visualization | — Pending |
| Homelab emoji selector instead of free-text | Fun, visual, prevents inappropriate content | — Pending |
| Smooth animation over terminal-style output | More visually impressive on stage for a large audience | — Pending |
| Admin panel over CLI-only controls | Easier to manage during a live talk under pressure | — Pending |

---
*Last updated: 2026-03-20 after initialization*
