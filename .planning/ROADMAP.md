# Roadmap: KubeCon Guestbook

## Overview

This roadmap delivers a live KubeCon audience participation app in four phases following the hard dependency chain: server and submission form first (data must flow before it can be visualized), visualization engine second (the core value proposition), admin controls third (presenter needs a working app to control), and deployment plus validation last (load test the real deployment, not localhost). Each phase produces a testable artifact that the next phase builds on. The coarse phase structure reflects that this is a focused, single-purpose app -- not an enterprise platform.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Server Core + Submission Form** - End-to-end data pipeline: monorepo, database, API, SSE broadcaster, and mobile-friendly submission form (completed 2026-03-20)
- [ ] **Phase 2: Visualization Engine** - Real-time K8s cluster visualization with D3 force-based namespace clustering and Canvas rendering (gap closure in progress)
- [ ] **Phase 3: Admin Panel** - Presenter control surface: submission toggle, moderation, stats, and post-talk read-only mode
- [ ] **Phase 4: Deployment + Validation** - Containerize, deploy to homelab K8s, load test at 500 concurrent users, and rehearse the live demo

## Phase Details

### Phase 1: Server Core + Submission Form
**Goal**: Attendees can open a URL on their phone, submit their info, and the submission flows through the system end-to-end (API receives it, persists it, broadcasts it via SSE)
**Depends on**: Nothing (first phase)
**Requirements**: SUBM-01, SUBM-02, SUBM-03, SUBM-04, SUBM-05, SUBM-06, SUBM-07, INFR-04
**Success Criteria** (what must be TRUE):
  1. Attendee can open a short URL on a phone and see a mobile-friendly submission form that loads in under 2 seconds on a throttled connection
  2. Attendee can enter their name, select a location from a dropdown, pick a homelab emoji from a curated grid, and submit -- receiving a "You're now a pod!" confirmation
  3. Submitting a name containing profanity is rejected with a user-friendly message
  4. A QR code is generated that resolves to the submission form URL
  5. An SSE client connected to the server receives a new-submission event within 2 seconds of form submission (verifiable via curl or browser DevTools)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Go server core: SQLite store, REST API, SSE broadcaster, profanity filter, QR code, tests
- [x] 01-02-PLAN.md -- Preact frontend: mobile submission form, country dropdown, homelab scale, confirmation, build integration

### Phase 2: Visualization Engine
**Goal**: New submissions appear as animated pods in a full-screen K8s cluster visualization, grouped into namespace clusters by location, suitable for a 1920x1080 projector
**Depends on**: Phase 1
**Requirements**: VIZZ-01, VIZZ-02, VIZZ-03, VIZZ-04, VIZZ-05, VIZZ-06, VIZZ-07, VIZZ-08, VIZZ-09, VIZZ-10
**Success Criteria** (what must be TRUE):
  1. When a new submission arrives via SSE, a pod appears on the visualization within 1-2 seconds with a smooth entrance animation (fade/slide)
  2. Pods are visually grouped into namespace clusters labeled with K8s-style naming (e.g., ns/berlin, ns/london), and new pods join the correct cluster based on their location
  3. Each pod displays the attendee's name and selected emoji using K8s-themed visual language (rounded-rect shapes, status indicators)
  4. The visualization renders 500 pods without frame drops or performance degradation (Canvas rendering, profiled in DevTools)
  5. Presenter can hover over any pod to see full attendee details, and a live stats overlay shows total pod count and namespace count
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md -- Foundation: GET /api/submissions endpoint, D3 dependencies, TypeScript types, /viz routing, canvas scaffold
- [x] 02-02-PLAN.md -- Core engine: D3 force simulation, Canvas renderer, entrance animations, SSE integration, initial load cascade
- [x] 02-03-PLAN.md -- Overlays and performance: StatsOverlay, HoverCard with hover detection, 500-pod performance verification
- [ ] 02-04-PLAN.md -- Gap closure: Fix cluster overlap with inter-cluster repulsion force and tuned simulation parameters
- [ ] 02-05-PLAN.md -- Gap closure: Add pan/zoom navigation for large visualizations

### Phase 3: Admin Panel
**Goal**: Presenter has a control panel to manage the guestbook during and after the live talk -- open/close submissions, moderate content, and view stats
**Depends on**: Phase 1
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05
**Success Criteria** (what must be TRUE):
  1. Admin can log in with a password/shared secret and access the admin panel; unauthenticated users are denied access
  2. Admin can toggle submissions open/closed with a single button, and the mobile form immediately reflects the closed state (no new submissions accepted)
  3. Admin can delete an individual pod entry and it disappears from the visualization in real-time (broadcast via SSE)
  4. Admin panel displays live stats: total submissions, submissions over time, and top locations
  5. When submissions are closed, the guestbook transitions to a read-only mode that remains visitable as a lasting artifact
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Go backend: auth (session cookies), admin state (toggle + config table), store extensions (delete, stats), SSE event types, admin API endpoints, tests
- [ ] 03-02-PLAN.md -- Preact frontend: login form, dashboard (toggle, stats, pod list with delete), SSE client extension, viz deletion integration, end-to-end verification

### Phase 4: Deployment + Validation
**Goal**: Application runs reliably on the homelab Kubernetes cluster and has been validated under production load conditions identical to the live talk scenario
**Depends on**: Phase 2, Phase 3
**Requirements**: INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. Application is containerized and running on the homelab K8s cluster with a working ingress, TLS, and a PVC for SQLite persistence
  2. Data survives pod restarts and redeployments (kill the pod, verify submissions are still present after restart)
  3. Load test confirms the system handles 500 concurrent submissions within 60 seconds without errors or degraded response times
  4. SSE connections remain stable for 10+ minutes without ingress timeout kills (NGINX proxy-read-timeout configured, keep-alive verified)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
Note: Phases 2 and 3 both depend on Phase 1 but are independent of each other. They could be executed in either order, but Phase 2 (visualization) is higher risk and should come first.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server Core + Submission Form | 2/2 | Complete   | 2026-03-20 |
| 2. Visualization Engine | 3/5 | Gap closure | - |
| 3. Admin Panel | 0/2 | Planning complete | - |
| 4. Deployment + Validation | 0/? | Not started | - |
