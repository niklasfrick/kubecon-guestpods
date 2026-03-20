# Technology Stack

**Project:** KubeCon Guestbook
**Researched:** 2026-03-20
**Overall Confidence:** HIGH

## Recommended Stack

### Runtime & Package Manager

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x LTS (22.22.1) | Server runtime | Active LTS until April 2027; native ESM, built-in test runner, stable WebSocket support. The app is simple enough that Bun/Deno advantages don't justify the K8s ecosystem friction. |
| pnpm | 9.x | Package manager | 75% less disk usage than npm via content-addressable store; strict dependency resolution prevents phantom deps; first-class workspace support for monorepo layout. |
| TypeScript | 5.7.x | Type safety | Shared types between frontend and backend prevent the #1 bug class in real-time apps: message shape mismatches. |

### Backend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | 5.8.x | HTTP server | 2-3x faster than Express, built-in JSON schema validation, excellent TypeScript support. Chosen over Hono because Hono's Node.js WebSocket story requires extra adapters, while Fastify has mature plugin ecosystem for Node.js servers. |
| Socket.IO | 4.8.3 | Real-time transport | Built-in rooms/namespaces map perfectly to location-based grouping. Automatic reconnection handles the conference WiFi reality. 500 users is trivial for a single Socket.IO instance (tested to 10-30K). Chosen over raw `ws` because the developer experience advantages (rooms, reconnection, fallbacks) outweigh the ~5% overhead at this scale. |
| fastify-socket.io | 5.x | Fastify-Socket.IO bridge | Adds `io` decorator to Fastify instance. Plugin is simple enough that staleness is not a concern -- it's a thin wrapper. |
| @fastify/static | latest | Static file serving | Serves the built frontend from the same process, avoiding the need for a separate nginx container in K8s. |
| @fastify/cors | latest | CORS handling | Needed for development (Vite dev server on different port) and if QR code domain differs from API. |

### Frontend Framework & Build

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.x (19.2.4) | UI framework | Largest ecosystem for visualization libraries; D3 + React integration patterns are battle-tested; Niklas likely already knows React. Chosen over Svelte (smaller bundle but weaker D3 integration patterns) and Preact (would work but React 19 is fast enough for 500 nodes). |
| Vite | 8.x | Build tool | Near-instant HMR for development; Rolldown-based production builds are faster and smaller than Vite 7. The `react-ts` template provides zero-config TypeScript + React setup. |
| @vitejs/plugin-react | 6.x | React Vite plugin | Uses Oxc instead of Babel -- smaller install, faster transforms. |

### Visualization & Animation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| D3 (d3-force, d3-hierarchy) | 7.9.x | Physics layout engine | The `forceCluster` + `forceCollide` combination provides exactly the "pods grouped by namespace" layout. D3 handles the physics simulation; React renders the actual DOM. No other library provides this specific force-directed clustering capability as maturely. |
| d3-force-cluster | 0.x | Cluster force plugin | Adds a cluster centering force that pulls nodes toward group centroids -- precisely the "group by location/namespace" behavior needed. |
| Motion (formerly Framer Motion) | 12.x (12.36.0) | Enter/exit animations | Declarative `<AnimatePresence>` handles pod appear/disappear animations. Lower learning curve than react-spring; the "layout" animation feature automatically animates position changes when D3 recalculates. |
| SVG (native) | -- | Rendering target | At 500 nodes, SVG performs well (struggles start at ~5,000+). SVG allows each pod to be a React component with its own event handlers, tooltips, and accessibility. Canvas would be premature optimization and lose React's component model. |

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | New Oxide engine (Rust-based) is 5x faster. One-line setup (`@import "tailwindcss"`). Perfect for the mobile submission form where rapid UI development matters. The visualization itself uses SVG styles, not Tailwind. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite (via better-sqlite3) | latest | Data persistence | Zero-config, file-based, no separate database container needed in K8s. At 500 records with simple queries, SQLite is dramatically simpler than PostgreSQL. Synchronous API via better-sqlite3 eliminates connection pool complexity. Mount a PersistentVolume for the .db file and you're done. |
| Drizzle ORM | 0.45.x | Type-safe queries | Lightweight (7.4KB), zero dependencies, uses better-sqlite3 as driver. TypeScript-first schema definitions generate types shared with the frontend. Chosen over Prisma (too heavy for this app -- Prisma Client alone is 8MB+) and raw SQL (loses type safety). |
| drizzle-kit | latest | Migrations | Generates and runs SQL migrations from TypeScript schema changes. |

### Infrastructure & Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker (multi-stage) | -- | Containerization | Stage 1: build TypeScript + Vite. Stage 2: `node:22-slim` runtime image. Target ~50MB final image. |
| Kubernetes manifests | -- | Orchestration | Deployment + Service + PersistentVolumeClaim. No Helm needed for a single-app deployment. Keep it simple -- raw YAML manifests that Niklas can `kubectl apply`. |
| node:22-slim | -- | Base image | Debian-slim based, ~70MB smaller than full node image. Chosen over Alpine (native module compatibility with better-sqlite3 is smoother on Debian) and distroless (harder to debug on a homelab). |

### Development Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Biome | latest | Linting + formatting | Single tool replaces ESLint + Prettier. 10-20x faster (Rust-based). Zero config needed for TypeScript + React. |
| tsx | latest | TypeScript execution | Runs .ts files directly during development. Faster than ts-node, simpler than tsc --watch. |
| concurrently | latest | Dev process runner | Runs Vite dev server + Fastify backend simultaneously in one terminal. |

### Shared Types (Monorepo)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm workspaces | -- | Monorepo structure | Three packages: `packages/shared` (types), `packages/server`, `packages/client`. Shared types ensure Socket.IO event payloads are type-checked on both sides. |

## Project Structure

```
kubecon-guestbook/
  pnpm-workspace.yaml
  packages/
    shared/           # TypeScript types for Socket.IO events, DB models
      src/types.ts
    server/           # Fastify + Socket.IO + SQLite
      src/
        index.ts
        routes/
        db/
        socket/
    client/           # React + Vite + D3 + Motion
      src/
        components/
        hooks/
        views/
  k8s/                # Kubernetes manifests
  Dockerfile
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Server framework | Fastify | Express | Express is slower, lacks built-in schema validation, and the ecosystem has stalled. Fastify is the modern standard. |
| Server framework | Fastify | Hono | Hono shines on edge/serverless runtimes. On Node.js for a K8s deployment, Fastify's deeper plugin ecosystem and native WebSocket integration patterns win. |
| Server framework | Fastify | NestJS | Massive overkill for a single-purpose guestbook. NestJS adds DI, modules, decorators -- unnecessary complexity. |
| Real-time | Socket.IO | Raw WebSocket (ws) | Would need to manually implement reconnection, room management, and message serialization. Socket.IO solves all of this. The overhead is negligible at 500 users. |
| Real-time | Socket.IO | SSE (Server-Sent Events) | SSE is unidirectional (server-to-client only). The admin panel needs bidirectional communication. Socket.IO handles both directions. |
| Frontend | React | Svelte | Svelte has better raw performance and smaller bundles, but D3 + Svelte integration patterns are less mature. The React + D3 "D3 for layout, React for rendering" pattern is well-documented. |
| Frontend | React | Vanilla JS + D3 | Would work and be smaller, but loses component model benefits for the form, admin panel, and visualization overlays. Not worth it. |
| Database | SQLite | PostgreSQL | PostgreSQL requires a separate container, connection string management, and a persistent volume for its data directory. All overkill for ~500 rows of guestbook data. |
| Database | SQLite | Redis | Redis is great for ephemeral real-time state but poor for the "lasting artifact" requirement. Data should survive pod restarts without complex backup strategies. |
| ORM | Drizzle | Prisma | Prisma Client is ~8MB, generates a query engine binary, and is significantly heavier. For 3 tables and simple queries, Drizzle's lightweight approach is better. |
| Animation | Motion | react-spring | react-spring is more powerful for physics simulations but has a steeper learning curve. Motion's declarative API (`animate`, `exit`, `layout`) maps directly to the pod lifecycle. |
| Animation | Motion | CSS transitions | CSS can't handle the dynamic enter/exit coordination needed when pods appear in real-time. `AnimatePresence` is purpose-built for this. |
| Visualization | SVG | Canvas | Canvas loses React's component model -- each pod can't be an independent component with its own state and handlers. At 500 elements, SVG is performant. |
| Visualization | SVG | WebGL | Extreme overkill. WebGL shines at 100K+ elements. Would add massive complexity for zero benefit at this scale. |
| Build | Vite | webpack | Webpack is slower, more complex to configure, and Vite is the standard for new React projects. |
| Styling | Tailwind | CSS Modules | Tailwind is faster for prototyping the form UI. CSS Modules would work but require more boilerplate. |
| Package manager | pnpm | npm | npm workspaces work but pnpm's strict hoisting, faster installs, and disk efficiency make it strictly better for monorepos. |

## Installation

```bash
# Initialize monorepo
pnpm init
# Create workspace config
echo 'packages:\n  - "packages/*"' > pnpm-workspace.yaml

# Server dependencies
cd packages/server
pnpm add fastify @fastify/static @fastify/cors socket.io fastify-socket.io better-sqlite3 drizzle-orm
pnpm add -D @types/better-sqlite3 drizzle-kit tsx typescript concurrently

# Client dependencies
cd ../client
pnpm add react react-dom socket.io-client d3-force d3-force-cluster motion
pnpm add -D @types/react @types/react-dom @types/d3-force @vitejs/plugin-react vite typescript tailwindcss

# Shared types
cd ../shared
pnpm add -D typescript
```

## Key Version Constraints

| Package | Min Version | Reason |
|---------|-------------|--------|
| Node.js | 22.x | Required for native ESM support, fetch API, structured clone |
| React | 19.x | Required for `use()` hook, improved Suspense patterns |
| Vite | 8.x | Rolldown bundler provides significantly faster builds |
| Socket.IO | 4.7+ | Required for connection state recovery feature |
| Tailwind | 4.x | New CSS-first config, Oxide engine performance |
| Fastify | 5.x | Required for modern plugin API, Node 22 support |

## Confidence Assessment

| Choice | Confidence | Rationale |
|--------|------------|-----------|
| Node.js 22 LTS | HIGH | Verified via nodejs.org -- 22.22.1 is current LTS |
| Fastify 5.x | HIGH | Verified via npm -- 5.8.2 is latest, well-supported |
| Socket.IO 4.8 | HIGH | Verified via npm -- 4.8.3 is latest, rooms/namespaces well-documented |
| React 19.x | HIGH | Verified via npm -- 19.2.4 is latest stable |
| Vite 8 | HIGH | Verified via vite.dev -- Vite 8 with Rolldown is released |
| D3 force layout | HIGH | d3-force + d3-force-cluster is the standard approach for clustered node visualizations |
| Motion 12.x | HIGH | Verified via npm -- 12.36.0 is latest, actively maintained |
| SQLite + Drizzle | MEDIUM | SQLite is perfect for this scale; Drizzle 0.45.x is pre-1.0 but stable and actively developed. The risk is low -- schema is trivial. |
| Tailwind 4.x | HIGH | Verified via tailwindcss.com -- v4 is stable with Oxide engine |
| fastify-socket.io | MEDIUM | Last published 2 years ago (v5.1.0), but the integration surface is tiny (thin wrapper). If broken, the fallback is 10 lines of manual integration. |

## Sources

- [Node.js 22.22.1 LTS release](https://nodejs.org/en/blog/release/v22.22.0)
- [Fastify npm](https://www.npmjs.com/package/fastify) -- v5.8.2
- [Socket.IO npm](https://www.npmjs.com/package/socket.io) -- v4.8.3
- [React 19.2 announcement](https://react.dev/blog/2025/10/01/react-19-2)
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8)
- [D3 force layout documentation](https://d3js.org/)
- [d3-force-cluster npm](https://www.npmjs.com/package/d3-force-cluster)
- [Motion (Framer Motion) npm](https://www.npmjs.com/package/motion) -- v12.36.0
- [Drizzle ORM npm](https://www.npmjs.com/drizzle-orm) -- v0.45.1
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4)
- [pnpm workspaces documentation](https://pnpm.io/workspaces)
- [Socket.IO rooms documentation](https://socket.io/docs/v4/rooms/)
- [Fastify Socket.IO plugin](https://www.npmjs.com/package/fastify-socket.io)
- [SVG vs Canvas performance benchmarks](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [Better Stack: Fastify vs Express vs Hono](https://betterstack.com/community/guides/scaling-nodejs/fastify-vs-express-vs-hono/)
