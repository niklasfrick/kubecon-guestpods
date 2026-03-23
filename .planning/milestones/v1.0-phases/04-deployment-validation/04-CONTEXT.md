# Phase 4: Deployment + Validation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Containerize the application, create a Helm chart for Kubernetes deployment, set up CI/CD for automated image builds, and validate the system handles the live talk scenario (500 concurrent submissions, stable SSE connections). The app itself is complete — this phase is purely infrastructure, packaging, and validation.

</domain>

<decisions>
## Implementation Decisions

### Cluster environment
- Talos Linux Kubernetes cluster, 3+ nodes with plenty of resources
- Cilium Gateway API for ingress (not NGINX or Traefik)
- Rook Ceph block storage for PVCs (replicated, not node-bound)
- cert-manager + Let's Encrypt for TLS certificates
- ArgoCD for GitOps deployment — watches a separate gitops repo (not this repo)

### Domain & external access
- Domain TBD — plan should use a placeholder (e.g., `guestbook.example.com`)
- Cloudflare DNS with proxied mode (orange cloud) — CNAME chain to gateway with A record
- Cloudflare terminates TLS and proxies traffic to the cluster
- **Critical SSE concern:** Cloudflare proxied mode has ~100-second idle timeout. Server MUST send periodic keep-alive comments (`: keepalive\n\n` every 30 seconds) to prevent Cloudflare from dropping SSE connections
- cert-manager still handles origin certificates between Cloudflare and the cluster

### Container image
- Multi-stage Dockerfile: Node stage (build frontend) → Go stage (build binary with embedded frontend) → distroless runtime
- Base image: `gcr.io/distroless/static` — minimal attack surface, no shell
- Static Go binary with `CGO_ENABLED=0` (SQLite needs CGo — use `modernc.org/sqlite` or confirm current driver)
- Push to GitHub Container Registry: `ghcr.io/<owner>/kubecon-guestbook`
- Semver image tags (e.g., `v1.0.0`)

### Helm chart
- Chart lives in `chart/` directory in this repo
- Generic chart with sensible defaults — homelab-specific values (Rook Ceph storage class, Cilium Gateway API resources, domain) are overridden in the gitops repo
- Chart should include: Deployment, Service, PVC, Gateway API HTTPRoute (not Ingress), Certificate (cert-manager), ConfigMap/Secret for env vars
- Configurable values: image tag, replica count, storage class, storage size, domain, admin password secret ref, resource limits

### CI/CD pipeline
- GitHub Actions workflow: push to main → build image → push to ghcr.io with semver tag
- Trigger: tag push (e.g., `v*`) for releases
- Multi-platform build not needed (amd64 only for homelab)

### Load testing
- k6 load test scripts in `loadtest/` directory — version-controlled, reproducible
- Scenario: 500 concurrent POST /api/submissions within 60 seconds
- Run against the live deployment URL (full path through Cloudflare → ingress → app)
- SSE stability: manual soak test (not automated in k6) — open connections for 10+ minutes, verify no drops
- Success criteria from roadmap: zero errors, no degraded response times under 500 concurrent submissions

### Claude's Discretion
- Exact Helm chart template structure and helper functions
- k6 script implementation details (ramp-up pattern, think time, thresholds)
- GitHub Actions workflow details (caching, build optimization)
- Dockerfile optimization (layer caching, build arg usage)
- Resource requests/limits values in chart defaults
- Health check and readiness probe configuration
- Whether to check CGo requirement for current SQLite driver and adapt accordingly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in the decisions above and in `.planning/REQUIREMENTS.md` (INFR-01, INFR-02, INFR-03).

### Prior phase context
- `.planning/phases/01-server-core-submission-form/01-CONTEXT.md` — Tech stack decisions (Go + Preact + SQLite), env vars (`DB_PATH`, `ADMIN_PASSWORD`, `BASE_URL`, `ADDR`)
- `.planning/phases/02-visualization-engine/02-CONTEXT.md` — SSE event format, Canvas rendering (no server-side concerns for deployment)
- `.planning/phases/03-admin-panel/03-CONTEXT.md` — Admin auth via env var password, cookie-based sessions, SSE event types (submission, deletion, state)

### Application entry point
- `main.go` — Server configuration, env vars, port binding, route registration
- `server/sse.go` — SSE implementation, needs keep-alive modification for Cloudflare
- `server/store.go` — SQLite setup with WAL mode, `DB_PATH` configuration
- `go.mod` — Module name and Go version (1.26.1), check SQLite driver CGo requirements
- `web/package.json` — Frontend build commands for Dockerfile
- `Makefile` — Existing build targets to reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/sse.go` — SSEHub already sets `X-Accel-Buffering: no` header for proxy compatibility; needs keep-alive ticker addition
- `/api/health` endpoint — Ready for K8s liveness/readiness probes
- `Makefile` — Has `build` and `build-web` targets; Dockerfile can reference similar commands
- `embed.go` — Frontend embedding pattern means single binary deployment

### Established Patterns
- Single Go binary serves everything (API + static frontend + SSE)
- All config via env vars: `DB_PATH`, `ADMIN_PASSWORD`, `BASE_URL`, `ADDR`
- SQLite WAL mode with single-writer connection pool
- Preact + Vite frontend builds to `web/dist/`

### Integration Points
- `server/sse.go` — Add keep-alive ticker (30s interval) to prevent Cloudflare 100s idle timeout
- `go.mod` — Check if `modernc.org/sqlite` (pure Go) or `mattn/go-sqlite3` (CGo) is used — affects Dockerfile `CGO_ENABLED` setting
- `main.go` — Graceful shutdown handling for K8s pod termination (SIGTERM)

</code_context>

<specifics>
## Specific Ideas

- Cloudflare SSE keep-alive is the most critical infrastructure concern — without it, the visualization will break for attendees after ~100 seconds of no new submissions
- The Helm chart should be a clean, portable reference even though ArgoCD deploys from a separate repo — someone forking this project should be able to `helm install` directly
- Load test must hit the real URL through Cloudflare to validate the full path, not just the app in isolation
- Distroless base image means no shell for debugging — if needed, use `kubectl debug` with an ephemeral container

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-deployment-validation*
*Context gathered: 2026-03-22*
