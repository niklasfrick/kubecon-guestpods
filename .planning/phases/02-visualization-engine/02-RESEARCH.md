# Phase 2: Visualization Engine - Research

**Researched:** 2026-03-21
**Domain:** Real-time Canvas visualization with D3 force simulation, Preact integration
**Confidence:** HIGH

## Summary

Phase 2 builds a full-screen Canvas-based visualization where attendee submissions appear as animated pods grouped into namespace clusters by country. The core technology stack is D3 force simulation (v3) driving node positions, rendered to a Canvas 2D context via requestAnimationFrame, within a Preact component. The visualization receives real-time updates via the browser's native EventSource API connecting to the existing SSE endpoint.

The key architectural challenge is keeping D3's force simulation (which mutates node positions in-place) decoupled from Preact's rendering cycle. Since Canvas rendering bypasses the DOM entirely, the visualization component should use `useRef` for the canvas element and manage its own animation loop via `requestAnimationFrame`, avoiding Preact re-renders for the hot path. Preact signals remain useful for discrete UI state (stats overlay, hover card visibility) but node positions must live outside the signal system.

**Primary recommendation:** Use individual d3 sub-packages (d3-force, d3-polygon, d3-ease, d3-timer) rather than the full d3 bundle. Implement a custom cluster force function (20-30 lines) rather than depending on the unmaintained d3-force-cluster (v0.1.2) package. Use offscreen canvas caching for pod rendering to hit the 500-pod performance target.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rounded-rectangle shape (~60x30px) with subtle drop shadow and ~6px rounded corners -- K8s pod diagram style
- Colored by homelab level (5 distinct colors): Level 1 soft blue, Level 2 pink/coral, Level 3 amber, Level 4 teal, Level 5 purple
- Each pod displays homelab emoji + first name (truncated at ~8 chars)
- Hover reveals expanded card: full name, flag emoji + namespace label, homelab level description text -- NO timestamp
- Soft translucent background fill (10-15% opacity) as cluster boundary -- convex hull or padded bounding box, NOT dotted borders
- Neutral gray/slate tones for all cluster backgrounds -- pods provide the color, clusters provide the structure
- Namespace label at top of cluster region, white text on dark badge
- Size-based gravity layout: largest clusters gravitate toward center, smaller ones orbit at edges
- Every country gets its own namespace cluster, even with only 1 attendee -- no "other" bucket
- Scale up + glow entrance animation: pod starts at 0 size, scales up with glow/pulse in level color, glow fades after ~2 seconds
- Smooth easing (ease-out-back)
- Burst handling: staggered entry with ~200ms delay between pods; queue if >20 pending
- Namespace cluster reacts to new pods: boundary smoothly expands, label briefly pulses/brightens
- Full-screen Canvas edge-to-edge, dark solid background (#0f172a / slate-900)
- No header bar, no side panel -- maximum space for visualization
- Stats overlay in top-left corner: "42 pods . 8 namespaces" -- real-time counter, minimal footprint
- No grid pattern or background texture -- clean dark background for projector contrast
- Initial load: fetch existing submissions via GET /api/submissions, animate with fast staggered cascade (~50ms per pod)
- After initial cascade, new SSE submissions animate at normal ~200ms stagger speed

### Claude's Discretion
- Exact color hex values for the 5 homelab level pod colors
- D3 force simulation parameters (charge strength, collision radius, cluster gravity)
- Convex hull algorithm and padding calculation
- Canvas rendering implementation details (draw order, hit testing for hover)
- Stats overlay exact styling and positioning
- Performance optimization approach for 500 pods
- Font choices and text rendering on Canvas
- How to handle window resize

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIZZ-01 | New submissions appear as pods within 1-2s via SSE | SSE EventSource API, animation queue system |
| VIZZ-02 | Pods grouped into namespace clusters by location | Custom cluster force + d3-polygon convex hull |
| VIZZ-03 | Namespace clusters labeled with K8s-style naming | Canvas text rendering on dark badge above hull |
| VIZZ-04 | New pods animate in smoothly (fade/slide entrance) | d3-ease easeBackOut + scale animation pattern |
| VIZZ-05 | Pods use K8s-themed visual language (rounded-rect) | Canvas roundRect() API (baseline since April 2023) |
| VIZZ-06 | Pods display attendee name and selected emoji | Canvas fillText + emoji rendering with caching |
| VIZZ-07 | Pods arrange organically via D3 force simulation | d3-force v3: forceManyBody, forceCollide, forceX/Y, custom cluster |
| VIZZ-08 | Live stats overlay shows pod count + namespace count | Preact signal-driven DOM overlay on top of canvas |
| VIZZ-09 | Presenter hover shows full attendee details | simulation.find() for hit testing + DOM tooltip overlay |
| VIZZ-10 | 500 pods without performance degradation | Offscreen canvas caching, batched rendering, force tuning |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-force | 3.0.0 | Force simulation engine | Industry standard for physics-based layout; manages node positions via velocity Verlet integration |
| d3-polygon | 3.0.1 | Convex hull computation | `polygonHull()` for namespace cluster boundaries; `polygonCentroid()` for label positioning |
| d3-ease | 3.0.1 | Easing functions | `easeBackOut` for the "overshoot and settle" entrance animation; pure math, no DOM dependency |
| d3-timer | 3.0.1 | Animation scheduling | Synchronized with requestAnimationFrame; manages entrance animation timers cleanly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-scale | 4.0.2 | Value mapping | Map cluster sizes to position offsets for size-based gravity |
| d3-color | 3.1.0 | Color manipulation | Programmatic alpha/brightness adjustments for glow effects |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force-cluster (v0.1.2) | Custom cluster force function | d3-force-cluster is unmaintained (v0.x), last published years ago. A custom 20-line force function is trivial and fully controllable |
| d3-force-clustering (v1.0.0) | Custom cluster force function | Adds unnecessary dependency. Custom force matches exact size-based gravity behavior needed |
| Full d3 bundle | Individual d3-* packages | Full bundle is ~280KB. Individual packages total ~15KB for what we need |
| PixiJS / WebGL | Canvas 2D | 500 pods is well within Canvas 2D capacity. WebGL adds complexity without benefit at this scale |

### TypeScript Type Definitions

| Package | Version | For |
|---------|---------|-----|
| @types/d3-force | 3.0.10 | SimulationNodeDatum, Force, ForceLink types |
| @types/d3-polygon | 3.0.2 | polygonHull, polygonCentroid signatures |
| @types/d3-ease | 3.0.2 | Easing function types |
| @types/d3-timer | 3.0.2 | Timer types |
| @types/d3-scale | 4.0.9 | Scale types |
| @types/d3-color | 3.1.3 | Color types |

**Installation:**
```bash
cd web && npm install d3-force d3-polygon d3-ease d3-timer d3-scale d3-color && npm install -D @types/d3-force @types/d3-polygon @types/d3-ease @types/d3-timer @types/d3-scale @types/d3-color
```

## Architecture Patterns

### Recommended Project Structure
```
web/src/
  viz/
    VizPage.tsx            # Top-level /viz route component
    Canvas.tsx             # Canvas element + animation loop (useRef, useEffect)
    simulation.ts          # D3 force simulation setup and management
    renderer.ts            # Canvas 2D drawing logic (pods, clusters, labels)
    types.ts               # PodNode, Cluster, AnimationState interfaces
    colors.ts              # Homelab level color map, glow color derivations
    clusterForce.ts        # Custom cluster attraction force
    animationQueue.ts      # Entrance animation queue with stagger timing
    sseClient.ts           # EventSource connection + reconnection
    StatsOverlay.tsx       # DOM overlay for pod/namespace counts
    HoverCard.tsx          # DOM overlay for pod hover details
  api.ts                   # (existing) Add fetchSubmissions() function
  app.tsx                  # (existing) Add /viz route
```

### Pattern 1: Canvas + D3 Force in Preact (Imperative Canvas, Declarative UI Overlays)

**What:** The visualization canvas is managed imperatively (refs + requestAnimationFrame), while UI overlays (stats, hover card) are Preact components positioned absolutely over the canvas.

**When to use:** Always for this phase. Canvas rendering must bypass the VDOM for performance.

**Example:**
```typescript
// Source: MDN Canvas API + d3-force official docs
interface PodNode extends SimulationNodeDatum {
  id: number;
  name: string;
  countryCode: string;
  countryFlag: string;
  homelabLevel: number;
  homelabEmoji: string;
  // Added by d3-force:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  // Custom fields:
  clusterId: string;        // country_code for grouping
  animProgress: number;     // 0..1 entrance animation progress
  animStartTime: number;    // timestamp when animation started
  glowOpacity: number;      // 0..1 for glow fade
}

function VizCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<PodNode, undefined>>(null);
  const nodesRef = useRef<PodNode[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // Set canvas to full viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create simulation
    simRef.current = forceSimulation<PodNode>()
      .force('charge', forceManyBody().strength(-30).distanceMax(200))
      .force('collide', forceCollide<PodNode>().radius(35).iterations(2))
      .force('center', forceCenter(canvas.width / 2, canvas.height / 2).strength(0.05))
      .force('cluster', clusterForce())  // custom
      .on('tick', () => {}); // positions updated in-place

    // Animation loop
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawClusterBoundaries(ctx, nodesRef.current);
      drawPods(ctx, nodesRef.current);

      animFrameRef.current = requestAnimationFrame(render);
    }
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      simRef.current?.stop();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
```

### Pattern 2: Custom Cluster Force (Size-Based Gravity)

**What:** A force function that pulls nodes toward their cluster centroid, with larger clusters positioned closer to center.

**When to use:** For the size-based gravity layout requirement.

**Example:**
```typescript
// Source: Observable @d3/clustered-bubbles pattern, adapted
function clusterForce(strength = 0.15) {
  let nodes: PodNode[];

  function force(alpha: number) {
    // Compute cluster centroids
    const clusters = new Map<string, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      const c = clusters.get(node.clusterId);
      if (c) {
        c.x += node.x!;
        c.y += node.y!;
        c.count++;
      } else {
        clusters.set(node.clusterId, { x: node.x!, y: node.y!, count: 1 });
      }
    }
    for (const c of clusters.values()) {
      c.x /= c.count;
      c.y /= c.count;
    }

    // Pull nodes toward their cluster centroid
    for (const node of nodes) {
      const c = clusters.get(node.clusterId)!;
      node.vx! += (c.x - node.x!) * alpha * strength;
      node.vy! += (c.y - node.y!) * alpha * strength;
    }
  }

  force.initialize = (n: PodNode[]) => { nodes = n; };
  return force;
}
```

### Pattern 3: Convex Hull Cluster Boundaries with Padding

**What:** Compute convex hull per cluster, expand with padding, draw with translucent fill.

**Example:**
```typescript
// Source: d3-polygon official docs
import { polygonHull, polygonCentroid } from 'd3-polygon';

function drawClusterBoundaries(ctx: CanvasRenderingContext2D, nodes: PodNode[]) {
  const clusters = groupBy(nodes, n => n.clusterId);

  for (const [clusterId, clusterNodes] of clusters) {
    if (clusterNodes.length < 1) continue;

    // Get points with padding for hull
    const padding = 25;
    const points: [number, number][] = [];
    for (const n of clusterNodes) {
      // Add corners of padded bounding box per node
      points.push([n.x! - padding, n.y! - padding]);
      points.push([n.x! + padding, n.y! - padding]);
      points.push([n.x! + padding, n.y! + padding]);
      points.push([n.x! - padding, n.y! + padding]);
    }

    const hull = polygonHull(points);
    if (!hull) continue;

    // Draw smooth hull with rounded corners
    ctx.beginPath();
    drawSmoothHull(ctx, hull); // Catmull-Rom or simple rounded path
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)'; // slate-400 at 12%
    ctx.fill();

    // Draw namespace label above hull
    const centroid = polygonCentroid(hull);
    drawNamespaceLabel(ctx, clusterId, centroid, hull);
  }
}
```

### Pattern 4: Entrance Animation Queue

**What:** Manage staggered pod entrance animations with queue and timer.

**Example:**
```typescript
// Source: d3-ease, d3-timer official docs
import { easeBackOut } from 'd3-ease';
import { timer } from 'd3-timer';

class AnimationQueue {
  private queue: PodNode[] = [];
  private active = false;
  private staggerMs: number;

  constructor(staggerMs = 200) {
    this.staggerMs = staggerMs;
  }

  enqueue(pods: PodNode[]) {
    this.queue.push(...pods);
    if (!this.active) this.flush();
  }

  private flush() {
    this.active = true;
    let index = 0;
    const t = timer((elapsed) => {
      while (index < this.queue.length && index * this.staggerMs <= elapsed) {
        const pod = this.queue[index];
        pod.animStartTime = performance.now();
        pod.animProgress = 0;
        // Add to simulation
        this.onActivate(pod);
        index++;
      }
      if (index >= this.queue.length) {
        t.stop();
        this.queue = [];
        this.active = false;
      }
    });
  }

  onActivate: (pod: PodNode) => void = () => {};
}
```

### Anti-Patterns to Avoid

- **Putting node positions in Preact state/signals:** D3 force mutates positions in-place 60 times per second. Piping this through signals or setState would trigger 60 re-renders/sec. Keep positions in plain arrays accessed via refs.
- **Using SVG for 500+ animated elements:** SVG DOM manipulation at this scale causes jank. Canvas is mandatory per project decision.
- **Redrawing text/emoji on every frame from scratch:** `fillText()` and emoji rendering are expensive. Cache pod visuals to offscreen canvases.
- **Creating a new d3 simulation for each new pod:** Reuse one simulation, add nodes dynamically with `simulation.nodes(updatedArray)` and call `simulation.alpha(0.3).restart()`.
- **Blocking the main thread during initial load cascade:** If 300+ pods arrive via GET, don't animate them all synchronously. Use the staggered queue with fast timing (50ms).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed layout | Custom physics engine | d3-force v3 `forceSimulation` | Barnes-Hut optimization, velocity Verlet integration, well-tuned defaults |
| Convex hull computation | Graham scan or similar | d3-polygon `polygonHull` | Andrew's monotone chain algorithm, handles edge cases, returns counterclockwise |
| Easing curves | Custom bezier math | d3-ease `easeBackOut` | Dozens of well-tested curves including back (overshoot) easing |
| Animation frame scheduling | Raw setInterval/setTimeout | `requestAnimationFrame` + d3-timer | Syncs with display refresh, pauses when tab inactive |
| Hit testing for hover | Pixel color picking | `simulation.find(x, y, radius)` | Built into d3-force, uses quadtree for O(log n) lookup |
| SSE reconnection | Custom WebSocket wrapper | Native `EventSource` API | Auto-reconnects, sends Last-Event-ID, zero dependencies |

**Key insight:** D3's sub-packages are pure computation modules with no DOM coupling. They compute positions, hulls, and easing values -- you draw them however you want. This makes them ideal companions for Canvas rendering.

## Common Pitfalls

### Pitfall 1: D3 Force Simulation Never Settles
**What goes wrong:** Simulation keeps running at high alpha, nodes drift endlessly.
**Why it happens:** Adding new nodes calls `simulation.alpha(1).restart()` which fully reheats. With continuous arrivals, alpha never decays.
**How to avoid:** When adding new pods, use a gentle reheat: `simulation.alpha(0.3).restart()`. This jostles existing nodes to make room without restarting the entire layout. Set `alphaDecay(0.02)` for steady settling.
**Warning signs:** Nodes visibly bouncing after 5+ seconds; CPU stays at 100%.

### Pitfall 2: Canvas Blurry on HiDPI / Retina Displays
**What goes wrong:** Text and shapes appear fuzzy on high-DPI screens (and on 1080p projectors that may have scaling).
**Why it happens:** Canvas pixel dimensions don't match CSS dimensions.
**How to avoid:** Scale canvas by `devicePixelRatio`:
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * dpr;
canvas.height = canvas.clientHeight * dpr;
ctx.scale(dpr, dpr);
```
**Warning signs:** Blurry text, fuzzy edges on rounded rectangles.

### Pitfall 3: Emoji Rendering Inconsistencies
**What goes wrong:** Emojis render differently across browsers/OS. Some appear as text glyphs, wrong size, or missing entirely.
**Why it happens:** Emoji rendering depends on the OS emoji font. Canvas `fillText` with emojis can be unreliable for sizing.
**How to avoid:** Use a known emoji font stack: `font = '14px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'`. Measure text width with `measureText()` before drawing. Consider caching emoji renders to offscreen canvases.
**Warning signs:** Emojis clipped, wrong position, or rendered as boxes.

### Pitfall 4: Convex Hull Fails for < 3 Points
**What goes wrong:** `d3.polygonHull()` returns `null` for fewer than 3 points.
**Why it happens:** A convex hull requires at least 3 non-collinear points.
**How to avoid:** Handle 1-pod and 2-pod clusters as special cases. For 1 pod: draw a simple padded rectangle. For 2 pods: draw an elongated capsule shape. Only compute hull for 3+ pods.
**Warning signs:** Clusters with 1-2 pods have no visible boundary.

### Pitfall 5: Memory Leak from EventSource
**What goes wrong:** SSE connection stays open after navigating away from /viz, consuming server resources.
**Why it happens:** EventSource not closed in cleanup.
**How to avoid:** Close EventSource in the Preact component's useEffect cleanup:
```typescript
useEffect(() => {
  const es = new EventSource('/api/submissions/stream');
  es.addEventListener('submission', handler);
  return () => es.close();
}, []);
```
**Warning signs:** Server logs show persistent SSE connections after page navigation.

### Pitfall 6: Force Simulation Overwork on Pod Addition
**What goes wrong:** Adding 300 pods on initial load causes the simulation to run hundreds of ticks before settling.
**Why it happens:** Each new node triggers reheat. With staggered entry, the simulation never cools.
**How to avoid:** For initial load, add all nodes at once (hidden, animProgress=0), run the simulation for ~100 ticks manually (`simulation.tick()`), then start the visual cascade. This pre-computes the layout before rendering.
**Warning signs:** Pods flying around chaotically during initial load instead of appearing in neat clusters.

### Pitfall 7: Canvas Mouse Coordinates Mismatch
**What goes wrong:** Hover detection misaligned -- hovering over a pod highlights the wrong one.
**Why it happens:** Mouse event coordinates are CSS pixels, but canvas may be scaled by devicePixelRatio.
**How to avoid:** Convert mouse coordinates:
```typescript
const rect = canvas.getBoundingClientRect();
const x = (event.clientX - rect.left);
const y = (event.clientY - rect.top);
// Use these CSS-space coords with simulation.find() since
// simulation coordinates match CSS-space (not canvas pixel space)
```
**Warning signs:** Hover works only in the top-left quadrant, or is offset.

## Code Examples

### Canvas Pod Rendering with Glow
```typescript
// Source: Canvas 2D API (MDN) + design decisions from CONTEXT.md
const LEVEL_COLORS: Record<number, string> = {
  1: '#60a5fa', // soft blue (Level 1: "What's a homelab?")
  2: '#fb7185', // pink/coral (Level 2: "A Pi and a dream")
  3: '#fbbf24', // amber (Level 3: "The spare laptop era")
  4: '#2dd4bf', // teal (Level 4: "Electricity bill")
  5: '#a78bfa', // purple (Level 5: "On-call rotation")
};

function drawPod(ctx: CanvasRenderingContext2D, node: PodNode) {
  const w = 60, h = 30, r = 6;
  const color = LEVEL_COLORS[node.homelabLevel];
  const progress = node.animProgress; // 0..1

  if (progress <= 0) return; // not yet visible

  const scale = easeBackOut(Math.min(progress, 1));

  ctx.save();
  ctx.translate(node.x!, node.y!);
  ctx.scale(scale, scale);

  // Glow effect (fades over 2 seconds)
  if (node.glowOpacity > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 * node.glowOpacity;
  }

  // Rounded rectangle body
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();

  // Reset shadow for text
  ctx.shadowBlur = 0;

  // Pod content: emoji + truncated name
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `${node.homelabEmoji} ${truncate(node.name, 8)}`;
  ctx.fillText(label, 0, 0);

  ctx.restore();
}

function truncate(s: string, maxLen: number): string {
  return [...s].length > maxLen ? [...s].slice(0, maxLen).join('') + '..' : s;
}
```

### SSE Client Connection
```typescript
// Source: MDN EventSource API
function connectSSE(onSubmission: (data: SubmitResponse) => void): () => void {
  const es = new EventSource('/api/submissions/stream');

  es.addEventListener('submission', (event: MessageEvent) => {
    try {
      const data: SubmitResponse = JSON.parse(event.data);
      onSubmission(data);
    } catch (e) {
      console.error('Failed to parse SSE submission:', e);
    }
  });

  es.onerror = () => {
    // EventSource auto-reconnects; log for debugging
    console.warn('SSE connection error, will auto-reconnect');
  };

  // Return cleanup function
  return () => es.close();
}
```

### Initial Load with Pre-computation
```typescript
// Source: d3-force docs (simulation.tick for manual stepping)
async function initializeVisualization(
  simulation: Simulation<PodNode, undefined>,
  queue: AnimationQueue
) {
  // Fetch all existing submissions
  const response = await fetch('/api/submissions');
  const submissions: SubmitResponse[] = await response.json();

  // Create nodes (initially hidden)
  const nodes = submissions.map(s => ({
    ...s,
    clusterId: s.country_code,
    animProgress: 0,
    animStartTime: 0,
    glowOpacity: 0,
  }));

  // Pre-compute layout (runs synchronously, no rendering)
  simulation.nodes(nodes);
  simulation.alpha(1);
  for (let i = 0; i < 120; i++) simulation.tick();

  // Now cascade them in visually with fast stagger
  queue.staggerMs = 50; // fast for initial load
  queue.enqueue(nodes);

  // After cascade, switch to normal speed for SSE arrivals
  setTimeout(() => { queue.staggerMs = 200; }, nodes.length * 50 + 500);
}
```

### Namespace Label Drawing
```typescript
// Source: Canvas 2D API, project design decisions
function drawNamespaceLabel(
  ctx: CanvasRenderingContext2D,
  countryCode: string,
  countryFlag: string,
  position: [number, number],
  hullTopY: number
) {
  const label = `${countryFlag} ns/${countryCode}`;
  ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
  const metrics = ctx.measureText(label);
  const padX = 8, padY = 4;
  const labelW = metrics.width + padX * 2;
  const labelH = 18;
  const x = position[0] - labelW / 2;
  const y = hullTopY - labelH - 6; // above hull

  // Dark badge background
  ctx.beginPath();
  ctx.roundRect(x, y, labelW, labelH, 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 at 85%
  ctx.fill();

  // White label text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, position[0], y + labelH / 2);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3-force v1/v2 with full d3 bundle | d3-force v3 as individual ESM package | d3 v7+ / d3-force v3 (2022) | Tree-shakeable, ~5KB instead of ~280KB |
| SVG for force-directed graphs | Canvas for 100+ nodes | Ongoing best practice | 5x faster rendering at 500+ nodes |
| d3-force-cluster (v0.1.2) | Custom force functions | d3-force-cluster unmaintained | 20 lines of code vs. stale dependency |
| Manual SVG convex hull paths | d3-polygon polygonHull | Stable | Pure computation, framework-agnostic |
| Custom path drawing for rounded rects | Canvas roundRect() native API | Baseline April 2023 | No polyfill needed for modern browsers |

**Deprecated/outdated:**
- `d3-force-cluster` (v0.1.2): Last meaningful update years ago, designed for d3 v4. Use custom force instead.
- `ctx.mozDash`, `ctx.webkitLineDash`: Replaced by standardized `ctx.setLineDash()`.

## Server-Side Integration Notes

### Missing API Endpoint
The `GET /api/submissions` endpoint does **not** exist yet. The `Store.GetAll()` method exists in Go and is tested, but no HTTP handler exposes it. Phase 2 must add:

```go
// In handler.go
func (h *Handler) HandleGetSubmissions() http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        submissions, err := h.store.GetAll()
        if err != nil {
            log.Printf("ERROR: get submissions: %v", err)
            writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to load submissions"})
            return
        }
        writeJSON(w, http.StatusOK, submissions)
    }
}

// In main.go
mux.HandleFunc("GET /api/submissions", handler.HandleGetSubmissions())
```

### Visualization Page Route
The `/viz` route is referenced in `web/src/api.ts:33` (redirect on 403) but no page exists. Two options:
1. **SPA route (recommended):** Handle `/viz` in the Preact router, serve the same `index.html` for all routes via a Go catch-all.
2. **Separate HTML entry:** Create a second Vite entry point for `/viz`.

Recommendation: Use a simple hash-based or path-based router in Preact. The Go server already serves `index.html` via the embedded filesystem's file server which handles unknown routes by serving the root.

### Vite Proxy Addition
Add the SSE stream endpoint to the Vite dev proxy (it's already covered by the `/api` prefix match in `vite.config.ts`).

## Open Questions

1. **Font availability on projector laptop**
   - What we know: Inter is a popular web font, system-ui fallback exists
   - What's unclear: Whether the demo laptop has Inter installed or if it needs to be bundled
   - Recommendation: Bundle Inter as a web font (woff2, ~20KB) or rely on system-ui which is good enough for 11px pod labels

2. **Single-page routing approach**
   - What we know: Preact has preact-router and preact-iso for routing
   - What's unclear: Whether to add a dependency or use a minimal hash-router
   - Recommendation: Use a minimal conditional render based on `window.location.pathname`. Two pages (`/` for form, `/viz` for visualization) don't warrant a router library. The Go server needs a catch-all to serve `index.html` for `/viz`.

3. **Size-based gravity toward center**
   - What we know: Larger clusters should gravitate to center. forceX/forceY with per-node strength can achieve this.
   - What's unclear: Exact formula for mapping cluster size to position
   - Recommendation: Use forceX(centerX).strength(node => clusterSizeRank(node) * 0.05) so nodes in larger clusters get pulled harder toward center. Requires computing cluster sizes and ranks on each simulation initialization.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing (server) + no frontend test framework |
| Config file | None for frontend |
| Quick run command | `go test ./server/ -run TestHandleGetSubmissions -v` |
| Full suite command | `go test ./... -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZZ-01 | SSE events received and parsed into pod nodes | manual | Browser DevTools: Network tab SSE stream | N/A |
| VIZZ-02 | Pods grouped by country_code into clusters | manual | Visual inspection: pods with same country in same cluster | N/A |
| VIZZ-03 | Namespace labels rendered with K8s naming | manual | Visual inspection: labels show flag + ns/CODE | N/A |
| VIZZ-04 | Entrance animation (scale + glow) | manual | Visual inspection: new pods scale in with glow | N/A |
| VIZZ-05 | Rounded-rect K8s pod visual | manual | Visual inspection: pods are colored rounded rectangles | N/A |
| VIZZ-06 | Pod displays emoji + name | manual | Visual inspection: emoji and truncated name visible | N/A |
| VIZZ-07 | D3 force layout arranges organically | manual | Visual inspection: pods don't overlap, clusters cohesive | N/A |
| VIZZ-08 | Stats overlay shows counts | manual | Visual inspection: top-left shows "X pods . Y namespaces" | N/A |
| VIZZ-09 | Hover shows full details | manual | Mouse hover: expanded card appears | N/A |
| VIZZ-10 | 500 pods no frame drops | manual-with-script | DevTools Performance profile while adding 500 test pods | N/A |
| -- | GET /api/submissions returns all submissions | unit | `go test ./server/ -run TestHandleGetSubmissions -v` | Wave 0 |

### Sampling Rate
- **Per task commit:** `go test ./... -v` + manual browser check at `http://localhost:5173/viz`
- **Per wave merge:** Full Go test suite + manual visual verification with 50+ test pods
- **Phase gate:** Go tests green + 500-pod DevTools performance profile showing <16ms frame time

### Wave 0 Gaps
- [ ] `server/handler_test.go` -- add `TestHandleGetSubmissions` for GET /api/submissions endpoint
- [ ] No frontend test infrastructure (Canvas visualization is primarily visual; manual testing is appropriate for this phase)

## Sources

### Primary (HIGH confidence)
- [d3-force v3 official docs](https://d3js.org/d3-force) - Force simulation API, all force types
- [d3-force simulation API](https://d3js.org/d3-force/simulation) - simulation lifecycle, alpha, find(), tick()
- [d3-force center](https://d3js.org/d3-force/center) - forceCenter API
- [d3-force collide](https://d3js.org/d3-force/collide) - forceCollide API
- [d3-force many-body](https://d3js.org/d3-force/many-body) - forceManyBody API
- [d3-force position](https://d3js.org/d3-force/position) - forceX, forceY API
- [d3-polygon official docs](https://d3js.org/d3-polygon) - polygonHull, polygonCentroid API
- [d3-ease official docs](https://d3js.org/d3-ease) - easeBackOut, overshoot parameter
- [d3-timer official docs](https://d3js.org/d3-timer) - timer, timeout, interval API
- [MDN CanvasRenderingContext2D.roundRect()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect) - Baseline since April 2023
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - SSE browser API
- [MDN Canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - offscreen canvas, batch rendering
- npm registry - verified all package versions via `npm view`

### Secondary (MEDIUM confidence)
- [Observable @d3/clustered-bubbles](https://observablehq.com/@d3/clustered-bubbles) - Custom cluster force pattern with centroid computation
- [D3 Force-Directed Graph with Convex Hull](https://observablehq.com/@sbryfcz/d3-force-directed-graph-with-convex-hull) - Hull rendering pattern
- [Canvas glowing particles (miguelmota.com)](https://miguelmota.com/bytes/canvas-glowing-particles/) - shadowBlur glow technique
- [web.dev Canvas performance](https://web.dev/articles/canvas-performance) - Offscreen canvas caching patterns

### Tertiary (LOW confidence)
- [d3-force-clustering GitHub](https://github.com/vasturiano/d3-force-clustering) - Alternative clustering library (not recommended; documented for awareness)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All d3 sub-packages verified against npm registry and official docs. Versions confirmed current.
- Architecture: HIGH - Canvas + D3 force is the established pattern for this scale. Preact integration pattern is straightforward (refs + imperative rendering).
- Pitfalls: HIGH - Common issues well-documented across MDN, D3 docs, and community resources. DPI scaling, hull edge cases, and simulation heating are verified concerns.
- Performance: MEDIUM - 500 pods is well within Canvas 2D capability based on benchmarks, but specific emoji rendering performance with shadowBlur glow needs validation during implementation.

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable libraries, no breaking changes expected)
