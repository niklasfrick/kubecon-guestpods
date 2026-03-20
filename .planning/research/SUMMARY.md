# Project Research Summary

**Project:** KubeCon Guestbook
**Domain:** Live audience participation app with real-time Kubernetes-style cluster visualization
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

This is a single-purpose, live-demo audience participation app with one chance to succeed: the 60-second window during a KubeCon talk when the presenter shows a QR code. Experts build this class of app (Mentimeter, Slido, Kahoot) with a clear separation between the lightweight attendee entry path (QR code -> mobile form -> HTTP POST, no auth, no persistent connection) and the display layer (one real-time connection on the presenter's laptop driving a cluster visualization). The defining insight from research is that the product's uniqueness is entirely the K8s metaphor — attendees do not just participate, they become pods in a living cluster — which means the visualization quality is the non-negotiable deliverable.

The recommended approach is a pnpm monorepo with three packages (shared types, Fastify + SQLite server, React + D3 + Canvas client), deployed as a single container on the homelab Kubernetes cluster. The stack is deliberately minimal: no external dependencies, no cloud services, no microservices. SQLite on a PVC handles persistence with zero operational overhead. Server-Sent Events push new submissions to the 2-3 display clients. D3 force simulation computes pod clustering; Canvas renders it — not SVG, which degrades at 500 animated elements on unknown projector hardware.

The dominant risk is the thundering herd: 300-500 attendees submitting simultaneously when the QR code appears on screen. This is the #1 cause of live demo failure in this category. Secondary risks are conference WiFi degrading form loads (mitigated by a sub-50KB form page), visualization rendering falling below 60fps on the projector laptop (mitigated by Canvas over SVG from day one), and Kubernetes ingress killing SSE connections after 60 seconds (mitigated by a one-line annotation). All three are known, preventable, and must be validated with load tests before the talk. The one-chance constraint makes every pitfall more severe than in a typical web app — there is no hotfix during a live stage demo.

## Key Findings

### Recommended Stack

The stack is a focused Node.js 22 monorepo: Fastify 5 + SSE on the server, React 19 + Vite 8 + D3 7 + Canvas on the client, SQLite via better-sqlite3 + Drizzle ORM for persistence, Tailwind 4 for the mobile form UI. TypeScript is used end-to-end with shared types in a `packages/shared` workspace package to prevent message shape mismatches between client and server. Everything runs in a single Docker container served by one K8s Deployment. There are no external service dependencies — every request resolves on the homelab.

One open question from research: STACK.md recommends Socket.IO 4.8 for rooms/reconnection; ARCHITECTURE.md and FEATURES.md both argue for SSE (simpler, works behind standard proxies, sufficient for server-to-client push). The recommendation is to start with SSE — it is architecturally correct for the visualization feed — and adopt Socket.IO only if the admin panel requires bidirectional push that SSE cannot cover.

**Core technologies:**
- Node.js 22 LTS + pnpm 9 workspaces: stable runtime with monorepo structure for shared types
- Fastify 5: 2-3x faster than Express, native TypeScript, built-in JSON schema validation
- SQLite + better-sqlite3 + Drizzle ORM 0.45: zero-config persistence on a K8s PVC, no separate database container
- React 19 + Vite 8 (Rolldown): fast builds for the mobile form and admin panel
- D3 7 force simulation + Canvas: physics-based pod clustering rendered via requestAnimationFrame, not SVG DOM
- Motion 12 (AnimatePresence): declarative enter/exit animations for pod scheduling lifecycle
- Tailwind 4 (Oxide engine): rapid UI development for the mobile submission form

### Expected Features

**Must have (table stakes — demo fails without these):**
- Mobile-friendly submission form (name, pre-defined location dropdown, curated emoji grid) — the attendee entry point
- QR code + short memorable URL on a slide — frictionless access, 3-4x higher engagement than typed URLs
- Real-time visualization with pod entrance animations — the core value proposition
- Namespace grouping by location with K8s visual language — what makes it a cluster visualization, not a word cloud
- Admin toggle to open/close submissions — presenter control under stage pressure
- Submission confirmation ("You're a pod now!") — prevents double submissions
- Data persistence via SQLite on PVC — the guestbook is a lasting artifact
- Basic profanity filter on name field — safety net for a public, unauthenticated form

**Should have (differentiators, add before the talk if time permits):**
- Physics-based D3 force layout with idle animation — pods organically arrange, namespace clusters breathe
- Live stats counter overlay (total pods, namespace count) — adds energy and collective participation sense
- Pod detail on hover/click (visualization screen only) — presenter can spotlight individual attendees
- Post-talk read-only mode with event branding — permanent "I was there" artifact
- Admin stats dashboard (submission rate over time, location breakdown) — operational visibility

**Defer (v2+, not essential for the talk):**
- Sound effects toggle — sensory enhancement but not essential
- Multi-event support — premature generalization; fork the repo for the next talk
- Social sharing from within the app — attendees can screenshot organically

**Hard anti-features (never build):**
- Free-text messages or chat — content moderation nightmare on a live screen in front of an audience
- Authentication or user accounts — kills 60-80% of participation; constrained inputs make it unnecessary
- Full emoji keyboard — content risk; the curated 15-25 tech/homelab emoji set IS the feature
- Proactive moderation queue — delays the real-time magic; constrained inputs plus reactive admin delete is sufficient

### Architecture Approach

Single-process Node.js monolith: one Fastify server handles HTTP submission API, SSE broadcast, admin API, and static file serving for all three client apps. This is the correct architecture for 100-500 users on a single K8s replica — not a scaling shortcut. The three client entry points (mobile form, visualization screen, admin panel) are built as separate Vite apps sharing types from `packages/shared`. SQLite is the source of truth; a small in-memory set holds connected SSE clients and a cached submissions_open flag to avoid DB reads on every POST.

**Major components:**
1. Mobile Form (React SPA, target sub-50KB) — name + location dropdown + emoji grid, one HTTP POST, static confirmation page; no persistent connection needed
2. Visualization Engine (D3 force simulation + Canvas render loop) — loads initial state via GET all submissions, then receives incremental pod additions over SSE
3. Admin Panel (React SPA) — submission toggle, reactive moderation (delete pod with immediate viz broadcast), live stats via SSE
4. REST API + SSE Broadcaster (Fastify routes) — validate submission, persist to SQLite, broadcast new-pod event to all connected clients
5. SQLite on PVC — source of truth for submissions and config (submissions_open flag)
6. Kubernetes manifests — Deployment + Service + PVC + Ingress with extended proxy timeouts and proxy-buffering off

**Build order follows hard architectural dependencies:** Server core + DB schema -> SSE broadcaster + mobile form -> visualization engine -> admin panel -> K8s deployment.

### Critical Pitfalls

1. **Thundering herd on QR reveal** — 300-500 simultaneous submissions can overwhelm the backend during the most important 60 seconds of the talk. Prevention: load test with k6 or artillery simulating 500 concurrent submissions before the talk; keep the submission endpoint lean (validate, queue, respond 201); consider in-memory buffering with async SQLite flush.

2. **Visualization rendering crashes at 500 animated elements** — SVG DOM degrades exponentially with element count; 500 continuously animated SVG nodes can blow the 16ms frame budget on a modest laptop. Prevention: use Canvas from day one, not SVG; profile at 500 elements in Chrome DevTools before the talk; only animate `transform` + `opacity`.

3. **Conference WiFi kills form loads** — dense venue WiFi degrades above 50-75 connections per AP; attendees cannot reach the form. Prevention: form page must be sub-50KB total; HTTP POST only on attendee phones (no persistent connection); always display QR code AND a short typed URL as fallback; test on throttled 3G.

4. **Kubernetes ingress kills SSE connections after 60 seconds** — NGINX default `proxy-read-timeout` is 60s. Prevention: set `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"` and `proxy-buffering: "off"`; send SSE keep-alive comments every 15 seconds; implement `Last-Event-ID` reconnection on the client.

5. **Homelab goes down before or during the talk** — node reboot, power outage, cert expiry, DNS failure. Prevention: external uptime monitoring (UptimeRobot) with SMS alerts; run the app for 7+ days continuously before the talk; verify TLS cert expiry is more than 30 days beyond the talk date; keep a pre-recorded video fallback.

## Implications for Roadmap

Based on combined research, the build order follows architectural dependencies: each phase produces a testable artifact that the next phase builds on. The live-demo reliability constraint means testing is not a final phase — it is embedded in every phase and culminates in a dedicated pre-talk validation phase.

### Phase 1: Monorepo Foundation + Server Core

**Rationale:** Everything depends on the server API and database schema. Shared TypeScript types must exist before either the client or server can be built in earnest. This is the dependency root.
**Delivers:** Working Fastify server with SQLite schema, submission POST endpoint, GET all submissions endpoint, and health check; pnpm workspace with shared types package; Biome configured; testable via curl.
**Addresses:** Data persistence (table stakes), shared type safety (prevents message shape mismatches between client and server).
**Avoids:** Schema drift, phantom dependencies, starting visualization before data shape is finalized.

### Phase 2: Mobile Submission Form + SSE Broadcaster

**Rationale:** The form is every attendee's entry point and must be built before the visualization (which depends on real submissions flowing). The SSE broadcaster is built in this phase so events flow end-to-end for the first time.
**Delivers:** Sub-50KB mobile form (name + location dropdown + emoji grid + "You're a pod now!" confirmation); SSE endpoint broadcasting new-submission events; QR code generation; end-to-end flow testable: submit on a phone, see the event in browser DevTools.
**Addresses:** Mobile-friendly form, QR code + short URL, frictionless entry (no auth), submission confirmation — all table stakes.
**Avoids:** Conference WiFi problem (sub-50KB form, no SPA framework overhead), mobile background connection kills (fire-and-forget HTTP POST, no persistent phone connection).

### Phase 3: Visualization Engine

**Rationale:** Depends on SSE events flowing and the submission data shape being finalized. This is the highest-complexity and highest-risk phase. Must be started with enough lead time for performance profiling — a late discovery that SVG is too slow would require a ground-up rewrite.
**Delivers:** Full-screen Canvas visualization with D3 force clustering by location/namespace, pod entrance animations, live stats overlay; designed for 1920x1080 projector output with high-contrast dark background; profiled at 500 elements before phase is closed.
**Addresses:** Real-time visualization, namespace grouping, pod entrance animation, K8s visual language, live stats counter.
**Avoids:** SVG performance cliff (Canvas from day one), visualization not filling projector screen (1920x1080 from the start), physics layout feeling rigid (force simulation with idle gentle repulsion).

### Phase 4: Admin Panel + Moderation

**Rationale:** Depends on all server APIs existing. The admin panel is the presenter's control surface — the submission toggle is a P1 feature needed for the live talk.
**Delivers:** Admin panel with open/close submissions toggle, reactive moderation (delete a pod and it disappears from the visualization immediately via SSE broadcast), live submission stats, basic admin stats dashboard.
**Addresses:** Admin submission toggle (table stakes), post-talk read-only mode, reactive moderation, admin stats dashboard.
**Avoids:** Offensive content on the big screen (reactive delete works because constrained inputs minimize the need for proactive moderation); admin panel that requires complex interaction under stage pressure.

### Phase 5: Kubernetes Deployment + Hardening

**Rationale:** Application is feature-complete; now make it production-ready on the homelab cluster. This phase addresses all infrastructure pitfalls that could cause demo failure.
**Delivers:** Multi-stage Dockerfile (~50MB final image using node:22-slim); K8s manifests (Deployment + Service + PVC + Ingress); NGINX ingress annotations for SSE proxy timeouts; cert-manager TLS with expiry verification; external uptime monitoring with SMS alerts; deployment runbook.
**Addresses:** NGINX ingress SSE timeout, TLS cert management, homelab reliability, single-replica fault tolerance strategy.
**Avoids:** Ingress killing SSE connections at 60 seconds, cert expiry surprise at the venue, homelab going down without alerting.

### Phase 6: Pre-Talk Validation

**Rationale:** The one-chance constraint makes this phase non-optional. This is not QA — it is rehearsal with production load patterns. Must complete at least one week before the talk.
**Delivers:** Load test results (500 concurrent submissions via k6/artillery against the production homelab deployment); device matrix test (5+ phones covering iOS Camera, iOS Code Scanner, Android Chrome, Samsung Internet, one in-app browser); 3G throttle test confirming form loads in under 3 seconds; 5-minute SSE stability test with no submissions (verifies keep-alive prevents ingress timeout); full end-to-end demo rehearsal; pre-recorded video fallback.
**Addresses:** Thundering herd, conference WiFi degradation, QR code scanning fragmentation, homelab stability.
**Avoids:** All critical pitfalls — this phase proves that prevention worked.

### Phase Ordering Rationale

- Phases 1 through 4 follow the hard dependency chain from ARCHITECTURE.md: server before SSE before visualization before admin.
- Phase 3 (Visualization) is the highest-risk phase. It should be started as early as possible within the timeline — even if Phase 2 polish is still ongoing — because discovering a fundamental rendering problem late leaves no recovery time.
- Phase 5 (K8s deployment) precedes Phase 6 (validation) because load testing must target the real deployment, not localhost. Proxy timeout behavior and pod restart behavior cannot be validated without a real K8s environment.
- Phase 6 is explicitly separated from Phase 5 to ensure it is not collapsed or skipped under time pressure. Marking it complete requires passing the load test, not just finishing the deployment.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Visualization Engine):** The SVG vs Canvas decision is not fully resolved between STACK.md (recommends SVG + Motion) and ARCHITECTURE.md + PITFALLS.md (both recommend Canvas). Recommendation is Canvas — but the specific rendering approach (raw Canvas API vs Konva vs PixiJS) needs a short spike before committing. Also, `d3-force-cluster` (v0.x, pre-1.0) should be evaluated against the manual `forceX`/`forceY` centroid approach shown in ARCHITECTURE.md.
- **Phase 5 (K8s Deployment):** SQLite on a single-replica PVC has specific behavioral considerations (no concurrent writers means no horizontal scaling, pod restart behavior with an open DB file). The referenced article on SQLite + Kubernetes should be reviewed during phase planning.

Phases with well-documented patterns (research-phase can be skipped):
- **Phase 1 (Server Core):** Fastify + Drizzle + SQLite is fully documented; version choices are verified.
- **Phase 2 (Form + SSE):** Standard HTTP POST form + SSE broadcaster; ARCHITECTURE.md already contains working code examples.
- **Phase 4 (Admin Panel):** Straightforward CRUD + SSE consumption; no novel patterns.
- **Phase 6 (Validation):** k6 load testing and 3G throttle testing are standard practices with extensive documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major version choices verified against npm and official docs. Two MEDIUM items: Drizzle 0.45.x is pre-1.0 (low risk — schema is trivial); fastify-socket.io was last published 2 years ago (low risk — thin wrapper, easy to inline if broken). |
| Features | HIGH | Based on competitor analysis across Mentimeter, Slido, Kahoot, Guestbook.tv plus event technology best practices. Feature scope and anti-features are well-justified. |
| Architecture | HIGH | Single-process monolith, SSE over WebSockets for the visualization feed, Canvas over SVG for rendering — all supported by multiple sources. Main gap: SVG vs Canvas not fully resolved between research files (see Gaps below). |
| Pitfalls | HIGH | All critical pitfalls are documented production issues with specific evidence: thundering herd is a verified conference demo failure mode; NGINX ingress timeout has specific GitHub issue numbers; SVG performance cliff has published benchmarks at exactly this element count range. |

**Overall confidence:** HIGH

### Gaps to Address

- **SVG vs Canvas for visualization rendering:** STACK.md recommends SVG + Motion; ARCHITECTURE.md and PITFALLS.md both recommend Canvas. Must be resolved before Phase 3 begins. Recommendation: Canvas. The PITFALLS.md argument is more compelling — SVG at 500 continuously animated elements is fragile on unknown projector hardware, and the lack of a safety margin is unacceptable for a one-chance live demo. The Motion library can still be used for the mobile form and admin panel UI.
- **SSE vs Socket.IO for real-time transport:** STACK.md recommends Socket.IO; ARCHITECTURE.md and FEATURES.md recommend SSE. Resolve during Phase 1/2 planning. Tiebreaker: if the admin panel needs server-push for live stats, SSE covers it without Socket.IO. Socket.IO adds value primarily if "close submissions" commands need to be pushed to attendee form clients (which is a nice-to-have, not essential).
- **d3-force-cluster (v0.x) vs manual centroid forces:** The `d3-force-cluster` npm package is pre-1.0 and may not be actively maintained. The manual `forceX`/`forceY` centroid approach shown in ARCHITECTURE.md achieves the same result with no additional dependency. Evaluate during Phase 3 planning.
- **Location taxonomy for the dropdown:** The specific list of 15-30 locations to include for a KubeCon EU 2026 event has not been researched. Needs a decision before Phase 2. The list should reflect likely attendee origins (heavy Europe weighting, plus USA, India, and a catch-all "Other" bucket).

## Sources

### Primary (HIGH confidence)
- [Node.js 22.22.1 LTS release](https://nodejs.org/en/blog/release/v22.22.0) — runtime version
- [Fastify npm v5.8.2](https://www.npmjs.com/package/fastify) — server framework version
- [Socket.IO npm v4.8.3](https://www.npmjs.com/package/socket.io) — real-time transport evaluation
- [React 19.2 announcement](https://react.dev/blog/2025/10/01/react-19-2) — frontend framework version
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) — build tool version
- [Motion npm v12.36.0](https://www.npmjs.com/package/motion) — animation library version
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — styling framework version
- [D3 Force Simulation Documentation](https://d3js.org/d3-force/simulation) — visualization engine
- [Ably: WebSockets vs SSE](https://ably.com/blog/websockets-vs-sse) — transport decision
- [SVG Genie: SVG vs Canvas vs WebGL Benchmarks 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025) — rendering decision
- [kubernetes/ingress-nginx Issue #5167](https://github.com/kubernetes/ingress-nginx/issues/5167) — SSE/WebSocket 60s timeout pitfall
- [Harvest: Running SQLite on Kubernetes](https://www.getharvest.com/blog/running-sqlite-on-kubernetes-surprisingly-not-bad) — SQLite on K8s validation

### Secondary (MEDIUM confidence)
- [Better Stack: Fastify vs Express vs Hono](https://betterstack.com/community/guides/scaling-nodejs/fastify-vs-express-vs-hono/) — framework selection rationale
- [DEV.to: SSE proxy buffering production issue](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie) — SSE pitfall in production
- [Swizec: Smooth animation up to 4,000 elements with React and Canvas](https://swizec.com/blog/livecoding-14-mostlysmooth-animation-up-to-4000-elements-with-react-and-canvas/) — Canvas performance at scale
- [D3 Clustered Bubbles Observable Example](https://observablehq.com/@d3/clustered-bubbles) — force clustering pattern
- [Mentimeter word cloud features](https://www.mentimeter.com/features/word-cloud) — competitor analysis
- [KubeView K8s cluster visualization](https://kubeview.benco.io/) — visual design reference

### Tertiary (LOW confidence — validate during implementation)
- [d3-force-cluster npm](https://www.npmjs.com/package/d3-force-cluster) — pre-1.0; evaluate vs manual centroid approach before adopting
- [fastify-socket.io npm](https://www.npmjs.com/package/fastify-socket.io) — last published 2 years ago; thin wrapper, low risk but verify compatibility with Fastify 5 before using

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
