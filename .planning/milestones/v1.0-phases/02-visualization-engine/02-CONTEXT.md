# Phase 2: Visualization Engine - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time K8s cluster visualization: new submissions appear as animated pods grouped into namespace clusters by location, rendered on Canvas with D3 force layout, optimized for a 1920x1080 projector. Presenter can hover for details. Live stats overlay. Admin controls and moderation are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Pod visual design
- Rounded-rectangle shape (~60x30px) with subtle drop shadow and ~6px rounded corners — K8s pod diagram style
- Colored by homelab level (5 distinct colors): Level 1 💭 soft blue, Level 2 🍓 pink/coral, Level 3 🖥️ amber, Level 4 🗄️ teal, Level 5 🚀 purple
- Each pod displays homelab emoji + first name (truncated at ~8 chars)
- Hover reveals expanded card: full name, flag emoji + namespace label (🇩🇪 ns/DE), homelab level description text — NO timestamp

### Namespace cluster appearance
- Soft translucent background fill (10-15% opacity) as cluster boundary — convex hull or padded bounding box, NOT dotted borders
- Neutral gray/slate tones for all cluster backgrounds — pods provide the color, clusters provide the structure
- Namespace label (🇩🇪 ns/DE) at top of cluster region, white text on dark badge
- Size-based gravity layout: largest clusters (most popular countries) gravitate toward center, smaller ones orbit at edges
- Every country gets its own namespace cluster, even with only 1 attendee — no "other" bucket (consistent with Phase 1 decision)

### Entrance animation
- Scale up + glow: pod starts at 0 size, scales up with a glow/pulse in its level color, glow fades after ~2 seconds leaving a normal pod
- Smooth easing (ease-out-back)
- Burst handling: staggered entry with ~200ms delay between pods (10 pods = 2 second cascade); queue if >20 pending
- Namespace cluster reacts to new pods: boundary smoothly expands, label briefly pulses/brightens, then settles

### Screen layout
- Full-screen Canvas edge-to-edge, dark solid background (#0f172a / slate-900)
- No header bar, no side panel — maximum space for visualization
- Stats overlay in top-left corner: "42 pods · 8 namespaces" — real-time counter, minimal footprint
- No grid pattern or background texture — clean dark background for projector contrast

### Initial load behavior
- Fetch existing submissions via GET /api/submissions (GetAll), then animate in with fast staggered cascade (~50ms per pod)
- "Booting up the cluster" feel on page load
- After initial cascade completes, new SSE submissions animate at normal ~200ms stagger speed

### Claude's Discretion
- Exact color hex values for the 5 homelab level pod colors
- D3 force simulation parameters (charge strength, collision radius, cluster gravity)
- Convex hull algorithm and padding calculation
- Canvas rendering implementation details (draw order, hit testing for hover)
- Stats overlay exact styling and positioning
- Performance optimization approach for 500 pods
- Font choices and text rendering on Canvas
- How to handle window resize

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in the decisions above and in `.planning/REQUIREMENTS.md` (VIZZ-01 through VIZZ-10).

### Prior phase context
- `.planning/phases/01-server-core-submission-form/01-CONTEXT.md` — Homelab emoji scale definition (5 levels), namespace label format (flag + country code), K8s-themed language decisions, post-submission redirect to /viz

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/sse.go` — SSEHub with Subscribe/Unsubscribe/Broadcast, event format: `event: submission\ndata: {JSON}\n\n`
- `server/store.go` — `Store.GetAll()` returns all non-deleted submissions as `[]SubmitResponse`
- `server/model.go` — `SubmitResponse` struct: id, name, country_code, country_flag, homelab_level, homelab_emoji, created_at; `HomelabEmojis` map for level→emoji
- `web/src/api.ts` — TypeScript `SubmitResponse` interface matching Go struct

### Established Patterns
- Preact + Vite + TypeScript frontend in `web/` directory
- Preact signals for state management (`@preact/signals`)
- Go standard library HTTP server with method-pattern routing (Go 1.22+)
- Embedded frontend via `embed.go` — static assets served from `web/dist`

### Integration Points
- SSE endpoint: `GET /api/submissions/stream` — visualization connects here for real-time updates
- Submissions endpoint: `GET /api/submissions` — needs to be added (or use existing `GetAll()`) for initial load
- Route: `/viz` — referenced in Phase 1's closed-state redirect (`web/src/api.ts:32`)
- `main.go` mux — new route handler for `/viz` page needed

</code_context>

<specifics>
## Specific Ideas

- The initial load cascade should feel like "booting up the cluster" — theatrical moment for the presenter
- Glow effect on new pods is the key "wow moment" — attendee submits on phone, looks up, and spots their glowing pod appearing in the correct namespace
- Namespace cluster reaction (boundary expand + label pulse) reinforces that the pod "joined" a namespace — ties into the K8s metaphor
- Size-based gravity means Germany (KubeCon Europe host country) will likely dominate the center — this is a feature, not a bug

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-visualization-engine*
*Context gathered: 2026-03-21*
