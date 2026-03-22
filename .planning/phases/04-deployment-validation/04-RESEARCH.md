# Phase 4: Deployment + Validation - Research

**Researched:** 2026-03-22
**Domain:** Kubernetes deployment, containerization, CI/CD, load testing
**Confidence:** HIGH

## Summary

Phase 4 transforms the completed Go+Preact guestbook application into a production-ready Kubernetes deployment. The application already uses `modernc.org/sqlite` (pure Go, no CGo), which means `CGO_ENABLED=0` static binary compilation works out of the box -- the most critical containerization concern is resolved. The existing `/api/health` endpoint is ready for Kubernetes probes. The SSE hub at `server/sse.go` needs a keep-alive ticker to survive Cloudflare's proxy idle timeout.

The core deliverables are: (1) a multi-stage Dockerfile producing a distroless image, (2) a Helm chart with Gateway API HTTPRoute (not traditional Ingress), (3) a GitHub Actions CI workflow for automated image builds to ghcr.io, (4) k6 load test scripts validating 500 concurrent submissions, and (5) a small code change adding SSE keep-alive and graceful shutdown to `main.go`.

**Primary recommendation:** Start with the application code changes (SSE keep-alive + graceful shutdown), then Dockerfile, then Helm chart, then CI workflow, then load tests. The Helm chart should use Gateway API v1 resources with cert-manager annotations on the Gateway -- this matches the Cilium + cert-manager stack in the homelab.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Talos Linux Kubernetes cluster, 3+ nodes with plenty of resources
- Cilium Gateway API for ingress (not NGINX or Traefik)
- Rook Ceph block storage for PVCs (replicated, not node-bound)
- cert-manager + Let's Encrypt for TLS certificates
- ArgoCD for GitOps deployment -- watches a separate gitops repo (not this repo)
- Domain TBD -- plan should use a placeholder (e.g., `guestbook.example.com`)
- Cloudflare DNS with proxied mode (orange cloud) -- CNAME chain to gateway with A record
- Cloudflare terminates TLS and proxies traffic to the cluster
- Critical SSE concern: Cloudflare proxied mode has ~100-second idle timeout. Server MUST send periodic keep-alive comments (`: keepalive\n\n` every 30 seconds) to prevent Cloudflare from dropping SSE connections
- cert-manager still handles origin certificates between Cloudflare and the cluster
- Multi-stage Dockerfile: Node stage (build frontend) -> Go stage (build binary with embedded frontend) -> distroless runtime
- Base image: `gcr.io/distroless/static` -- minimal attack surface, no shell
- Static Go binary with `CGO_ENABLED=0` (SQLite needs CGo -- use `modernc.org/sqlite` or confirm current driver)
- Push to GitHub Container Registry: `ghcr.io/<owner>/kubecon-guestbook`
- Semver image tags (e.g., `v1.0.0`)
- Chart lives in `chart/` directory in this repo
- Generic chart with sensible defaults -- homelab-specific values overridden in gitops repo
- Chart should include: Deployment, Service, PVC, Gateway API HTTPRoute (not Ingress), Certificate (cert-manager), ConfigMap/Secret for env vars
- Configurable values: image tag, replica count, storage class, storage size, domain, admin password secret ref, resource limits
- GitHub Actions workflow: push to main -> build image -> push to ghcr.io with semver tag
- Trigger: tag push (e.g., `v*`) for releases
- Multi-platform build not needed (amd64 only for homelab)
- k6 load test scripts in `loadtest/` directory -- version-controlled, reproducible
- Scenario: 500 concurrent POST /api/submissions within 60 seconds
- Run against the live deployment URL (full path through Cloudflare -> ingress -> app)
- SSE stability: manual soak test (not automated in k6)
- Success criteria: zero errors, no degraded response times under 500 concurrent submissions

### Claude's Discretion
- Exact Helm chart template structure and helper functions
- k6 script implementation details (ramp-up pattern, think time, thresholds)
- GitHub Actions workflow details (caching, build optimization)
- Dockerfile optimization (layer caching, build arg usage)
- Resource requests/limits values in chart defaults
- Health check and readiness probe configuration
- Whether to check CGo requirement for current SQLite driver and adapt accordingly

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Application is containerized and deployable on a homelab Kubernetes cluster | Multi-stage Dockerfile pattern, Helm chart with Gateway API HTTPRoute, CI workflow for image builds |
| INFR-02 | Data persists across pod restarts (survives redeployment) | PVC template in Helm chart mounted at DB_PATH, SQLite WAL mode already configured |
| INFR-03 | Application handles burst traffic of 500 concurrent submissions within 60 seconds | k6 load test script, SSE keep-alive for connection stability, graceful shutdown for zero-downtime deploys |

</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker (multi-stage) | N/A | Container image build | Three-stage build: Node for frontend, Go for binary, distroless for runtime |
| `gcr.io/distroless/static` | latest | Runtime base image | No shell, no package manager, minimal attack surface; sufficient for static Go binaries |
| `golang:1.26-alpine` | 1.26.1 | Go build stage | Alpine variant for smaller build layer; matches project's Go 1.26.1 |
| `node:22-alpine` | 22.x | Frontend build stage | LTS Node for `npm ci && npm run build` |
| Helm | v4.0+ | Kubernetes package manager | Chart templating standard; v4 is current stable (verified locally: v4.0.5) |
| Gateway API | v1 | Kubernetes ingress routing | `gateway.networking.k8s.io/v1` HTTPRoute -- GA since v1.0, latest spec v1.4 |
| cert-manager | 1.15+ | TLS certificate automation | Gateway annotation `cert-manager.io/cluster-issuer` triggers automatic Certificate creation |
| k6 | latest | Load testing | Modern load testing tool, JavaScript scripts, supports HTTP POST scenarios |
| GitHub Actions | N/A | CI/CD | `docker/build-push-action@v7`, `docker/metadata-action@v6`, `docker/login-action@v3` |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `docker/setup-buildx-action` | v3 | Docker Buildx setup in CI | Required for `docker/build-push-action` |
| `actions/checkout` | v5 | Repository checkout in CI | Every CI workflow |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `distroless/static` | `scratch` | Scratch has no CA certs, timezone data, or /etc/passwd; distroless includes these |
| Gateway API HTTPRoute | Ingress | User decision: Cilium Gateway API is the cluster standard |
| k6 | `hey`, `vegeta` | k6 scripts are version-controllable JS, richer scenario modeling, better reporting |
| Helm chart | Raw manifests | Helm provides templating, values overrides for gitops, `helm install` for quick deploys |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
.
├── Dockerfile                          # Multi-stage build
├── .dockerignore                       # Exclude non-build files
├── .github/
│   └── workflows/
│       └── release.yaml                # CI: build + push image on tag
├── chart/
│   ├── Chart.yaml                      # Chart metadata
│   ├── values.yaml                     # Default values
│   └── templates/
│       ├── _helpers.tpl                # Template helpers
│       ├── deployment.yaml             # Pod spec with probes + PVC mount
│       ├── service.yaml                # ClusterIP service
│       ├── pvc.yaml                    # PersistentVolumeClaim for SQLite
│       ├── httproute.yaml              # Gateway API HTTPRoute
│       ├── gateway.yaml                # Gateway with cert-manager annotations (optional, may live in gitops repo)
│       ├── configmap.yaml              # Non-secret env vars (BASE_URL, ADDR)
│       └── NOTES.txt                   # Post-install instructions
└── loadtest/
    ├── submissions.js                  # k6: 500 concurrent POST submissions
    └── README.md                       # How to run load tests
```

### Pattern 1: Multi-Stage Dockerfile (3 stages)

**What:** Node build -> Go build -> Distroless runtime
**When to use:** Go applications with embedded frontend assets
**Example:**

```dockerfile
# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /guestbook .

# Stage 3: Runtime
FROM gcr.io/distroless/static:nonroot
COPY --from=builder /guestbook /guestbook
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/guestbook"]
```

**Key details:**
- `CGO_ENABLED=0` confirmed safe: project uses `modernc.org/sqlite` v1.47.0 (pure Go, no CGo)
- `-ldflags="-s -w"` strips debug info, reduces binary ~30%
- `nonroot` user in distroless for security
- Frontend `web/dist` is copied into Go build context so `//go:embed all:web/dist` works

### Pattern 2: Gateway API HTTPRoute (Cilium)

**What:** Kubernetes Gateway API v1 HTTPRoute for ingress routing
**When to use:** Cilium-based clusters using Gateway API instead of Ingress

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ include "guestbook.fullname" . }}
spec:
  parentRefs:
    - name: {{ .Values.gateway.name }}
      namespace: {{ .Values.gateway.namespace }}
  hostnames:
    - {{ .Values.domain }}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ include "guestbook.fullname" . }}
          port: {{ .Values.service.port }}
```

**Note:** The Gateway resource itself likely lives in the gitops repo (shared across apps). The chart should include the HTTPRoute only, with the Gateway name/namespace as configurable values.

### Pattern 3: cert-manager Gateway Annotation

**What:** Automatic TLS certificate issuance via Gateway annotation
**When to use:** cert-manager + Gateway API clusters

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: cilium
  listeners:
    - name: https
      hostname: guestbook.example.com
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - name: guestbook-tls
```

cert-manager automatically creates a Certificate resource and populates the referenced Secret. Since the Gateway is likely shared infrastructure, the chart should optionally include this or document it for the gitops repo.

### Pattern 4: SSE Keep-Alive Ticker

**What:** Periodic heartbeat comments to prevent Cloudflare proxy timeout
**When to use:** SSE connections behind Cloudflare proxied mode

```go
// In HandleSSE(), add a keep-alive ticker alongside the data channel
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()

for {
    select {
    case <-r.Context().Done():
        return
    case <-ticker.C:
        // SSE comment -- keeps Cloudflare connection alive
        w.Write([]byte(": keepalive\n\n"))
        flusher.Flush()
    case data := <-ch:
        w.Write(data)
        flusher.Flush()
    }
}
```

**Source:** Cloudflare connection limits docs confirm proxy read timeout of 120 seconds (not 100s as some community posts claim). The proxy idle timeout is 900 seconds, but the read timeout applies to time between bytes. Sending a comment every 30 seconds provides comfortable margin.

### Pattern 5: Graceful Shutdown

**What:** Handle SIGTERM for clean Kubernetes pod termination
**When to use:** Any Go HTTP server running in Kubernetes

```go
srv := &http.Server{Addr: *addr, Handler: wrapped}

go func() {
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
    <-sigCh
    log.Println("Shutting down gracefully...")
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}()

log.Printf("Server listening on %s", *addr)
if err := srv.ListenAndServe(); err != http.ErrServerClosed {
    log.Fatalf("Server failed: %v", err)
}
```

**Why needed:** Current `main.go` uses `http.ListenAndServe` which exits immediately on SIGTERM. Kubernetes sends SIGTERM during pod termination; without graceful shutdown, in-flight requests (including SSE connections) are dropped.

### Anti-Patterns to Avoid

- **Ingress resource instead of HTTPRoute:** The cluster uses Cilium Gateway API. Do not create an `Ingress` resource.
- **CGO_ENABLED=1 in Dockerfile:** The project uses `modernc.org/sqlite` (pure Go). Enabling CGo would require a C compiler in the build stage and a glibc-based runtime image. Unnecessary.
- **Mounting hostPath for SQLite:** Use a PVC with Rook Ceph storage class. hostPath would bind the pod to a single node.
- **Replica count > 1:** SQLite does not support concurrent writers from multiple processes. The deployment MUST be single-replica (`replicas: 1`).
- **ReadWriteMany PVC access mode:** SQLite with WAL mode requires single-writer access. Use `ReadWriteOnce`.
- **Skipping .dockerignore:** Without it, `guestbook.db`, `node_modules/`, `.git/`, and other large files are sent to the Docker build context, slowing builds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Container image tagging | Manual tag scripts | `docker/metadata-action` | Handles semver extraction from git tags, generates OCI labels |
| Docker layer caching in CI | Manual cache management | `type=gha` cache with build-push-action | GitHub Actions native cache, zero config |
| TLS certificate management | Manual cert generation | cert-manager Gateway annotation | Auto-renewal, Let's Encrypt integration, no manual steps |
| Load test orchestration | Custom bash scripts with curl | k6 with JavaScript scenarios | Proper VU modeling, thresholds, reporting, reproducible |
| Helm template helpers | Inline template logic | `_helpers.tpl` with standard patterns | `fullname`, `labels`, `selectorLabels` -- Helm convention |

**Key insight:** Every piece of infrastructure tooling in this phase has well-established patterns. The value is in correct configuration, not custom code.

## Common Pitfalls

### Pitfall 1: SQLite File Locking on PVC

**What goes wrong:** SQLite WAL mode requires the database file, WAL file, and SHM file to be on the same filesystem. If the PVC mount point doesn't include all three, file locking breaks.
**Why it happens:** The `DB_PATH` env var might point to a file while the PVC is mounted at a different path.
**How to avoid:** Mount the PVC at a directory (e.g., `/data`), set `DB_PATH=/data/guestbook.db`. SQLite creates `-wal` and `-shm` siblings automatically in the same directory.
**Warning signs:** `database is locked` errors, `SQLITE_BUSY` in logs.

### Pitfall 2: Cloudflare Buffering SSE Responses

**What goes wrong:** Cloudflare may buffer SSE responses, breaking real-time delivery. Even with `text/event-stream` Content-Type, some Cloudflare configurations hold responses until ~100KB accumulates.
**Why it happens:** Cloudflare's response buffering can interfere with streaming. The `X-Accel-Buffering: no` header (already set in `sse.go`) helps with upstream proxies but Cloudflare has its own buffering.
**How to avoid:** The existing `X-Accel-Buffering: no` header is already set. The keep-alive ticker ensures regular data flow. If buffering persists, Cloudflare's "Response buffering" can be disabled in the dashboard (Speed -> Optimization -> Content Optimization).
**Warning signs:** SSE events arrive in batches rather than individually.

### Pitfall 3: Distroless Has No Shell for Debugging

**What goes wrong:** Can't `kubectl exec` into a distroless container to debug.
**Why it happens:** `gcr.io/distroless/static` contains no shell, no package manager.
**How to avoid:** Use `kubectl debug` with an ephemeral container (`kubectl debug -it <pod> --image=busybox --target=guestbook`). Add structured logging to the application.
**Warning signs:** Need to investigate runtime issues but can't get a shell.

### Pitfall 4: Embed Directive Fails Without web/dist

**What goes wrong:** `go build` fails because `//go:embed all:web/dist` requires `web/dist/` to exist at compile time.
**Why it happens:** In the Dockerfile, if the frontend build output is not copied before `go build`, the embed directive has no files to embed.
**How to avoid:** The Dockerfile MUST `COPY --from=frontend /app/web/dist ./web/dist` BEFORE running `go build`.
**Warning signs:** Build error: `pattern all:web/dist: no matching files found`.

### Pitfall 5: GitHub Actions GITHUB_TOKEN Permissions

**What goes wrong:** `docker push` to ghcr.io fails with 403.
**Why it happens:** Default GITHUB_TOKEN doesn't have `packages: write` permission.
**How to avoid:** Explicitly set `permissions: { contents: read, packages: write }` in the workflow job.
**Warning signs:** `denied: permission_denied: write_package` in CI logs.

### Pitfall 6: PVC Not Retained on Helm Uninstall

**What goes wrong:** `helm uninstall` deletes the PVC, destroying all submission data.
**Why it happens:** Helm manages all resources it creates, including PVCs.
**How to avoid:** Add `helm.sh/resource-policy: keep` annotation to the PVC template. This tells Helm to leave the PVC on uninstall. Alternatively, rely on the StorageClass `reclaimPolicy: Retain`.
**Warning signs:** Data loss after `helm upgrade` or `helm uninstall && helm install`.

## Code Examples

### Verified: Current SSE Handler (Needs Modification)

```go
// Source: server/sse.go lines 67-97
// Current implementation -- NO keep-alive ticker
// The for/select loop only handles r.Context().Done() and data from channel
// MUST add a time.Ticker case for 30-second keep-alive
```

### Verified: Current main.go (Needs Graceful Shutdown)

```go
// Source: main.go lines 87-89
// Current: http.ListenAndServe(*addr, wrapped) -- no graceful shutdown
// MUST replace with http.Server + signal handling + Shutdown()
```

### Verified: SQLite Driver is Pure Go

```go
// Source: go.mod line 18
// modernc.org/sqlite v1.47.0 -- pure Go SQLite implementation
// CGO_ENABLED=0 is safe, no C compiler needed in Docker build
```

### k6 Load Test Pattern (500 Concurrent POSTs)

```javascript
// Source: k6 documentation patterns
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    burst_submissions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },  // Ramp to 500 VUs
        { duration: '50s', target: 500 },  // Hold at 500 VUs
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // <1% errors
    http_req_duration: ['p(95)<500'],       // 95th percentile < 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://guestbook.example.com';

export default function () {
  const payload = JSON.stringify({
    name: `LoadTest-${__VU}-${__ITER}`,
    country_code: 'DE',
    homelab_level: Math.ceil(Math.random() * 5),
  });

  const res = http.post(`${BASE_URL}/api/submissions`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'has id': (r) => JSON.parse(r.body).id > 0,
  });

  sleep(0.1); // Small think time
}
```

### GitHub Actions Release Workflow Pattern

```yaml
name: Release
on:
  push:
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v5

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v6
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ingress resource | Gateway API HTTPRoute | GA v1.0 Oct 2023, v1.4 Nov 2025 | More expressive routing, role-oriented design |
| `docker/build-push-action@v5` | `docker/build-push-action@v7` | Mar 2026 | Latest action version, Buildx improvements |
| `mattn/go-sqlite3` (CGo) | `modernc.org/sqlite` (pure Go) | Mature since 2023 | No C compiler, `CGO_ENABLED=0`, distroless-compatible |
| Manual cert management | cert-manager Gateway annotations | cert-manager 1.15+ (2024) | No feature flag needed, auto-cert from Gateway resource |

**Deprecated/outdated:**
- `extensions/v1beta1` Ingress: Removed since K8s 1.22. Use `networking.k8s.io/v1` or Gateway API.
- `docker/build-push-action@v5`: Still works but v7 is current. Use v7 for new workflows.

## Open Questions

1. **Gateway resource ownership**
   - What we know: The homelab uses ArgoCD with a separate gitops repo. The Gateway resource is likely shared infrastructure.
   - What's unclear: Should the Helm chart include an optional Gateway template, or only the HTTPRoute?
   - Recommendation: Include an optional Gateway template (disabled by default via `gateway.create: false`). The HTTPRoute always references the Gateway by name/namespace from values. Document that the Gateway typically lives in the gitops repo.

2. **Cloudflare response buffering behavior**
   - What we know: Community reports of SSE buffering despite `text/event-stream`. The `X-Accel-Buffering: no` header is already set.
   - What's unclear: Whether the current Cloudflare configuration will buffer responses.
   - Recommendation: The 30-second keep-alive ticker should produce enough data flow to prevent buffering issues. If problems persist during validation, disable "Response Buffering" in Cloudflare dashboard.

3. **Admin password secret management**
   - What we know: `ADMIN_PASSWORD` is required as env var. Helm chart needs to reference a Kubernetes Secret.
   - What's unclear: Whether the user wants the chart to create the Secret or reference an existing one.
   - Recommendation: Reference an existing Secret via `existingSecret` pattern. The actual Secret is created manually or via sealed-secrets/external-secrets in the gitops repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Go testing (stdlib) + k6 (load) |
| Config file | None needed for Go tests; k6 scripts in `loadtest/` |
| Quick run command | `go test ./... -count=1` |
| Full suite command | `go test -race -count=1 ./...` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Container builds and runs | smoke | `docker build -t guestbook:test . && docker run --rm -e ADMIN_PASSWORD=test -d guestbook:test` | No -- Wave 0 |
| INFR-01 | Helm chart templates render | unit | `helm template chart/` | No -- Wave 0 |
| INFR-02 | Data persists across pod restart | integration | Manual: `kubectl delete pod`, verify data | Manual-only (requires cluster) |
| INFR-03 | 500 concurrent submissions | load | `k6 run loadtest/submissions.js` | No -- Wave 0 |
| INFR-03 | SSE keep-alive works | unit | `go test ./server/ -run TestSSEKeepalive -count=1` | No -- Wave 0 |
| INFR-03 | Graceful shutdown | unit | `go test ./... -run TestGracefulShutdown -count=1` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `go test ./... -count=1`
- **Per wave merge:** `go test -race -count=1 ./... && helm template chart/ && docker build -t guestbook:test .`
- **Phase gate:** Full suite green + successful k6 load test against deployed instance

### Wave 0 Gaps

- [ ] `loadtest/submissions.js` -- k6 load test script for INFR-03
- [ ] SSE keep-alive test in `server/sse_test.go` or similar -- covers INFR-03 SSE stability
- [ ] Helm template render validation (`helm template chart/`) -- covers INFR-01 chart correctness
- [ ] Docker build smoke test -- covers INFR-01 containerization

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** -- `go.mod` confirms `modernc.org/sqlite v1.47.0` (pure Go, CGO_ENABLED=0 safe)
- **Codebase inspection** -- `server/sse.go` confirms X-Accel-Buffering header, no keep-alive ticker
- **Codebase inspection** -- `main.go` confirms no graceful shutdown, uses `http.ListenAndServe` directly
- [Cloudflare Connection Limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/) -- proxy read timeout 120s, proxy idle timeout 900s
- [Cilium HTTPS Gateway Example](https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/https/) -- Gateway + HTTPRoute YAML patterns
- [cert-manager Gateway Integration](https://cert-manager.io/docs/usage/gateway/) -- Gateway annotation pattern for auto-certs
- [GitHub Docs: Publishing Docker Images](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images) -- Official GHCR workflow
- [Docker Hub golang:1.26.1](https://hub.docker.com/_/golang/tags) -- Confirmed Go 1.26.1 image available
- [Gateway API v1.4](https://kubernetes.io/blog/2025/11/06/gateway-api-v1-4/) -- HTTPRoute GA, apiVersion `gateway.networking.k8s.io/v1`

### Secondary (MEDIUM confidence)

- [docker/build-push-action releases](https://github.com/docker/build-push-action/releases) -- v7 is current latest (Mar 2026)
- [docker/metadata-action](https://github.com/docker/metadata-action) -- v6 with semver tag support
- [k6 documentation](https://k6.io/docs/get-started/running-k6/) -- VU scenarios, thresholds, HTTP POST patterns
- [Kubernetes graceful shutdown](https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace) -- SIGTERM, terminationGracePeriodSeconds

### Tertiary (LOW confidence)

- Community reports of Cloudflare SSE buffering (may vary by plan/config)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools verified against official sources, versions confirmed
- Architecture: HIGH -- patterns from official Cilium, cert-manager, and Docker docs
- Pitfalls: HIGH -- most pitfalls identified from codebase inspection and verified documentation
- Load testing: MEDIUM -- k6 patterns are well-documented but SSE soak testing details are less standardized

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable tools, 30-day window)
