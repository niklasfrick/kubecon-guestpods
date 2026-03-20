# Architecture Research

**Domain:** Real-time interactive guestbook with live K8s-style cluster visualization
**Researched:** 2026-03-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                 │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Mobile Form     │  │  Visualization   │  │  Admin Panel     │  │
│  │  (Phone Browser) │  │  (Big Screen)    │  │  (Laptop)        │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │ HTTP POST           │ SSE/WS              │ HTTP + WS  │
├───────────┴─────────────────────┴─────────────────────┴─────────────┤
│                        Server Layer (Single Process)                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  REST API    │  │  Event       │  │  Admin API   │              │
│  │  (Submit)    │  │  Broadcaster │  │  (Moderate)  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
│  ┌──────┴─────────────────┴──────────────────┴──────────────────┐  │
│  │                    Application Core                           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │ Submission │  │ State      │  │ Moderation │              │  │
│  │  │ Handler    │  │ Manager    │  │ Handler    │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
├─────────────────────────┴───────────────────────────────────────────┤
│                        Data Layer                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SQLite (via PVC)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

This is a **monolith architecture** by design. At 100-500 users with a single-instance K8s deployment, splitting into microservices would add operational complexity with zero benefit. A single process handles HTTP, event broadcasting, and database access.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Mobile Form | Collect name, location, emoji from attendees | React/Preact SPA, mobile-first responsive layout |
| Visualization Display | Render animated pod cluster on big screen | Canvas-backed D3 force simulation with cluster grouping |
| Admin Panel | Toggle submissions, moderate entries, view stats | React SPA behind simple auth (password or token) |
| REST API | Accept submissions, serve current state | Express/Fastify HTTP routes |
| Event Broadcaster | Push new submissions to all connected visualization/admin clients | Server-Sent Events (SSE) broadcast channel |
| Application Core | Business logic: validate submissions, manage open/closed state, moderate | Pure functions, framework-agnostic |
| SQLite Database | Persist all submissions as lasting artifact | SQLite file on Kubernetes PVC |

## Recommended Project Structure

```
kubecon-guestbook/
├── server/                  # Backend (single Node.js process)
│   ├── index.ts             # Entry point, server bootstrap
│   ├── routes/              # HTTP route handlers
│   │   ├── submissions.ts   # POST /api/submissions, GET /api/submissions
│   │   ├── admin.ts         # Admin endpoints (toggle, moderate, stats)
│   │   └── events.ts        # GET /api/events (SSE endpoint)
│   ├── services/            # Business logic
│   │   ├── submission.ts    # Validation, creation, moderation
│   │   └── state.ts         # App state (open/closed, connected clients)
│   ├── broadcast.ts         # SSE broadcaster (manages connected clients)
│   ├── db.ts                # SQLite setup and queries
│   └── middleware/          # Auth, rate limiting
│       └── admin-auth.ts    # Simple token/password auth for admin
├── client/                  # Frontend (built at deploy time)
│   ├── form/                # Mobile submission form
│   │   ├── App.tsx          # Form component
│   │   └── index.html       # Entry point
│   ├── viz/                 # Visualization display
│   │   ├── App.tsx          # Visualization container
│   │   ├── simulation.ts    # D3 force simulation logic
│   │   ├── renderer.ts      # Canvas rendering loop
│   │   └── index.html       # Entry point
│   └── admin/               # Admin panel
│       ├── App.tsx           # Admin dashboard
│       └── index.html        # Entry point
├── shared/                  # Shared types and constants
│   ├── types.ts             # Submission, Event, Config types
│   └── constants.ts         # Emoji list, location mappings
├── k8s/                     # Kubernetes manifests
│   ├── deployment.yaml      # Single-replica deployment
│   ├── service.yaml         # ClusterIP or NodePort service
│   ├── ingress.yaml         # Ingress with TLS
│   └── pvc.yaml             # PersistentVolumeClaim for SQLite
├── Dockerfile               # Multi-stage build (build client, run server)
└── package.json
```

### Structure Rationale

- **server/:** Single Node.js process. Routes are thin HTTP handlers that delegate to services. Services contain business logic. This separation makes testing easy without requiring a running server.
- **client/form/, client/viz/, client/admin/:** Three distinct entry points. They are separate "apps" sharing types but optimized for their specific device/screen. The form is tiny (fast load on mobile). The viz is heavy (D3, Canvas). The admin is moderate.
- **shared/:** TypeScript types shared between client and server. The emoji list and submission schema live here so they cannot drift.
- **k8s/:** Kubernetes manifests kept in-repo. Single-replica deployment because SQLite does not support concurrent writers, and this scale does not need horizontal scaling.

## Architectural Patterns

### Pattern 1: Server-Sent Events for One-Way Broadcast

**What:** Use SSE instead of WebSockets for pushing new submissions to visualization and admin clients. The server maintains a list of connected SSE clients and broadcasts each new submission event to all of them.

**When to use:** When data flows primarily server-to-client (which is exactly this case -- attendees submit via HTTP POST, the visualization only receives).

**Trade-offs:**
- Pro: Simpler than WebSockets. Automatic reconnection built into the browser EventSource API. Works through HTTP proxies without special configuration. No library needed on the client.
- Pro: HTTP/2 multiplexing means SSE shares the connection with other HTTP requests.
- Con: Server-to-client only. But the submission form uses a regular HTTP POST, so bidirectional is unnecessary.
- Con: Limited to ~6 concurrent connections per domain in HTTP/1.1 (not an issue -- the viz screen has one connection, admin has one).

**Example:**
```typescript
// Server: SSE broadcaster
const clients = new Set<Response>();

function broadcast(event: SubmissionEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(data);
  }
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// Client: Visualization
const events = new EventSource('/api/events');
events.onmessage = (e) => {
  const submission = JSON.parse(e.data);
  addPodToSimulation(submission);
};
```

### Pattern 2: D3 Force Simulation with Canvas Rendering

**What:** Use D3's force simulation engine for layout computation (positioning pods into namespace clusters), but render using HTML5 Canvas instead of SVG DOM elements. D3 calculates where each pod should be; a requestAnimationFrame loop draws them on Canvas.

**When to use:** When you need physics-based grouping (pods clustering by location/namespace) with smooth animation. Canvas rendering keeps 500 animated elements performant even on modest hardware.

**Trade-offs:**
- Pro: D3 forceSimulation handles clustering elegantly -- `forceX`/`forceY` pull pods toward their namespace centroid, `forceCollide` prevents overlap, and `forceManyBody` provides gentle repulsion.
- Pro: Canvas renders 500+ animated circles at 60fps easily. SVG would likely work too at 500 elements, but Canvas provides a safety margin for lower-powered devices.
- Con: Canvas requires manual hit-testing for interactivity (not needed for the big-screen viz, which is view-only).
- Con: More code than SVG for rendering (you write the draw loop yourself).

**Example:**
```typescript
// Force simulation with cluster centers
const simulation = d3.forceSimulation(pods)
  .force('x', d3.forceX((d) => clusterCenters[d.location].x).strength(0.3))
  .force('y', d3.forceY((d) => clusterCenters[d.location].y).strength(0.3))
  .force('collide', d3.forceCollide(POD_RADIUS + 2))
  .force('charge', d3.forceManyBody().strength(-5));

// Canvas render loop
function draw() {
  ctx.clearRect(0, 0, width, height);
  drawNamespaceLabels(ctx, clusterCenters);
  for (const pod of pods) {
    ctx.beginPath();
    ctx.arc(pod.x, pod.y, POD_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = pod.color;
    ctx.fill();
    ctx.fillText(pod.emoji, pod.x - 8, pod.y + 4);
  }
  requestAnimationFrame(draw);
}
```

### Pattern 3: Optimistic Submission with Server Validation

**What:** The mobile form submits via HTTP POST. The server validates (name length, valid emoji, submissions open), persists to SQLite, then broadcasts via SSE. The form shows immediate "You're in!" feedback without waiting for the SSE broadcast.

**When to use:** When the submission path is simple (write-only from mobile, display-only on viz screen) and the critical user experience is the attendee feeling instant feedback on their phone.

**Trade-offs:**
- Pro: Simple request/response on mobile -- no WebSocket connection needed for the phone. Lower battery and bandwidth usage.
- Pro: Server is the single source of truth. No conflict resolution needed.
- Con: The attendee does not see their own pod appear on the big screen from their phone (they see it on the projected screen). This is actually fine -- the shared moment is looking up at the big screen.

## Data Flow

### Submission Flow (Primary)

```
[Attendee Phone]
    │
    │ HTTP POST /api/submissions
    │ { name, location, emoji }
    │
    ▼
[Server: REST API]
    │
    ├── Validate (name length, valid emoji, submissions open?)
    │
    ├── Persist to SQLite
    │   INSERT INTO submissions (name, location, emoji, created_at)
    │
    ├── Broadcast via SSE
    │   clients.forEach(c => c.write(event))
    │
    └── Return 201 Created
         { id, name, location, emoji }
    │
    ▼
[Attendee Phone: "You're in!" screen]


[SSE Broadcast]
    │
    ├──▶ [Visualization Screen]
    │     └── Add pod to D3 simulation
    │         └── Pod animates into namespace cluster
    │
    └──▶ [Admin Panel]
          └── Update stats, show new entry in list
```

### Visualization Initialization Flow

```
[Visualization Screen loads]
    │
    │ GET /api/submissions
    │
    ▼
[Server returns all existing submissions]
    │
    ▼
[Initialize D3 simulation with all pods]
    │
    │ GET /api/events (SSE connection)
    │
    ▼
[Listen for new submissions, add pods incrementally]
```

### Admin Flow

```
[Admin Panel]
    │
    ├── POST /api/admin/toggle     → Open/close submissions
    ├── DELETE /api/admin/submissions/:id  → Remove a submission (moderation)
    ├── GET /api/admin/stats       → Submission count, rate, locations
    │
    └── GET /api/events (SSE)      → Live updates for stats
```

### State Management

```
[SQLite - Source of Truth]
    │
    ├── submissions table (id, name, location, emoji, created_at, visible)
    └── config table (submissions_open: boolean)

[Server In-Memory]
    │
    ├── Connected SSE clients set
    ├── Cached submission count (for fast stats)
    └── submissions_open flag (avoid DB read on every POST)

[Visualization Client]
    │
    ├── D3 simulation nodes array (all pods with x,y positions)
    ├── Cluster centers map (location -> {x, y})
    └── Animation state (current frame via requestAnimationFrame)
```

### Key Data Flows

1. **Submission flow:** Phone POST -> Server validate+persist -> SSE broadcast -> Viz adds pod. Latency target: <500ms end-to-end. This is the critical path.
2. **Initial load flow:** Viz GET all submissions -> Build full simulation. Must work if the viz screen refreshes mid-talk.
3. **Admin moderation flow:** Admin DELETE submission -> Server marks invisible -> SSE broadcasts removal -> Viz removes pod with fade-out animation.
4. **State sync flow:** Admin toggles submissions open/closed -> Server updates state -> SSE broadcasts state change -> Form shows "Submissions closed" if navigated to.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (target) | Single process, single SQLite, single K8s replica. This is the design point. No scaling needed. |
| 500-2000 users | Same architecture. SQLite handles thousands of writes/sec. SSE broadcast to 2-3 clients is trivial. Bottleneck would be the D3 simulation on the viz client, not the server. |
| 2000+ users | Replace SQLite with PostgreSQL for concurrent write handling. Add Redis Pub/Sub if multiple server replicas needed. Canvas rendering might need optimization (spatial partitioning, level-of-detail). Not a realistic scenario for this project. |

### Scaling Priorities

1. **First bottleneck: Visualization rendering.** At 500 pods with D3 force simulation + Canvas, the viz client CPU is the constraint. Mitigations: reduce simulation tick rate after initial settle, use `simulation.alphaDecay(0.05)` to settle faster, throttle re-renders to 30fps instead of 60fps if needed.
2. **Second bottleneck: Burst of submissions.** 500 people submitting in a 2-minute window = ~4 submissions/sec. SQLite handles this easily. The SSE broadcast is O(connected_clients) per submission, and connected clients = 2-3 (viz screen + admin). This is not a real bottleneck.

## Anti-Patterns

### Anti-Pattern 1: WebSocket for Everything

**What people do:** Use WebSockets for both the submission form and the visualization, often via Socket.IO, creating bidirectional connections for every phone.
**Why it's wrong:** 500 phones maintaining persistent WebSocket connections consumes server resources for no benefit. The phones only need to POST once. WebSocket reconnection storms on flaky conference Wi-Fi create unnecessary load.
**Do this instead:** HTTP POST for submissions (stateless, works with any HTTP client, handles network flakes gracefully via standard retry). SSE for the 2-3 display clients that need real-time updates.

### Anti-Pattern 2: SVG DOM for 500 Animated Elements

**What people do:** Render each pod as an SVG circle element in the DOM, relying on D3's standard SVG bindings.
**Why it's wrong:** 500 SVG elements with continuous force simulation updates means 500 DOM mutations per animation frame. This works but is fragile -- a slower laptop projecting the visualization could drop frames, and you have no safety margin.
**Do this instead:** Use D3 for simulation math only. Render via Canvas with requestAnimationFrame. This decouples layout computation from rendering and gives 10x headroom on element count.

### Anti-Pattern 3: Real-Time Database (Firebase/Supabase) as Shortcut

**What people do:** Use Firebase Realtime Database or Supabase Realtime to avoid building a server, relying on their real-time sync for the visualization.
**Why it's wrong:** Adds an external dependency for a live talk demo (conference Wi-Fi to cloud service). The app must run on the homelab K8s cluster per project constraints. Also, these services handle sync complexity you do not have (multi-writer conflict resolution) while adding latency you do not want.
**Do this instead:** Keep the server local on the homelab. Direct SSE from server to viz client has minimal latency (same network or even same machine).

### Anti-Pattern 4: Separate Frontend and Backend Deployments

**What people do:** Deploy the API server as one K8s deployment and serve the frontend from a separate nginx deployment, or use a CDN.
**Why it's wrong:** For a homelab single-purpose app, this doubles the deployment surface and introduces CORS configuration. SSE connections from a different origin require additional setup.
**Do this instead:** Serve static frontend files from the same Node.js process. One Dockerfile, one deployment, one service. The server serves `/form/`, `/viz/`, `/admin/` as static files and `/api/*` as the API.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None | N/A | Intentionally zero external dependencies. The app is self-contained on the homelab cluster. Conference Wi-Fi reliability is a constraint -- the fewer external calls, the better. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Phone Form -> Server | HTTP POST (REST) | Stateless. Form submits and shows confirmation. No persistent connection. |
| Viz Display -> Server | HTTP GET (initial load) + SSE (ongoing) | SSE connection stays open for the duration of the talk. Auto-reconnects if dropped. |
| Admin Panel -> Server | HTTP (CRUD) + SSE (live updates) | Admin auth via Bearer token or simple password query param. |
| Server -> SQLite | Direct file I/O (better-sqlite3) | Synchronous API preferred (better-sqlite3 is sync, which is actually faster for single-process Node.js than async drivers). |
| D3 Simulation -> Canvas | In-process function call | D3 computes positions, Canvas renderer reads them. Same JS context, no serialization. |

## Build Order (Dependency Chain)

Components should be built in this order based on dependencies:

```
Phase 1: Server Core + Database
    └── HTTP server, SQLite schema, submission API, validation
    └── Can test with curl/Postman

Phase 2: SSE Broadcaster + Mobile Form
    └── Depends on: submission API exists
    └── SSE event stream, mobile-first form UI
    └── Can test: submit on phone, see events in browser DevTools

Phase 3: Visualization Engine
    └── Depends on: SSE events flowing, submission data shape finalized
    └── D3 force simulation, Canvas renderer, namespace clustering
    └── Can test: submit entries, watch pods appear on viz screen

Phase 4: Admin Panel
    └── Depends on: all APIs exist
    └── Toggle submissions, moderate, view stats
    └── Can test: full workflow end-to-end

Phase 5: Kubernetes Deployment
    └── Depends on: working application
    └── Dockerfile, K8s manifests, PVC for SQLite, Ingress
    └── Can test: deploy to homelab, run through full demo scenario
```

This ordering ensures each phase produces a testable artifact and that no phase requires work from a later phase.

## Sources

- [Ably: WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
- [SVG Genie: SVG vs Canvas vs WebGL Benchmarks 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [D3 Force Simulation Documentation](https://d3js.org/d3-force/simulation)
- [D3 Clustered Bubbles Observable Example](https://observablehq.com/@d3/clustered-bubbles)
- [FreeCodeCamp: Server-Sent Events vs WebSockets](https://www.freecodecamp.org/news/server-sent-events-vs-websockets/)
- [Harvest: Running SQLite on Kubernetes](https://www.getharvest.com/blog/running-sqlite-on-kubernetes-surprisingly-not-bad)
- [Tapflare: Canvas vs SVG vs WebGL Comparison](https://tapflare.com/articles/web-graphics-comparison-canvas-svg-webgl)
- [Jim Vallandingham: Bubble Charts with D3v4](https://vallandingham.me/bubble_charts_with_d3v4.html)
- [monotux.tech: SQLite, Kubernetes & Litestream](https://www.monotux.tech/posts/2025/05/sqlite-kubernetes-sts/)

---
*Architecture research for: Real-time interactive guestbook with K8s-style cluster visualization*
*Researched: 2026-03-20*
