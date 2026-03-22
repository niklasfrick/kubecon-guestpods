---
phase: 04-deployment-validation
plan: 02
subsystem: infra
tags: [helm, kubernetes, gateway-api, cert-manager, pvc, sqlite]

# Dependency graph
requires:
  - phase: 01-server-core-submission-form
    provides: "Go application with /api/health endpoint, env vars (DB_PATH, ADMIN_PASSWORD, BASE_URL, ADDR)"
provides:
  - "Helm chart for Kubernetes deployment with all resource templates"
  - "Gateway API HTTPRoute for Cilium ingress"
  - "cert-manager Certificate for TLS"
  - "PVC for SQLite persistence across pod restarts"
affects: [04-deployment-validation]

# Tech tracking
tech-stack:
  added: [helm]
  patterns: [helm-chart-convention, gateway-api-httproute, cert-manager-certificate, existing-secret-pattern]

key-files:
  created:
    - chart/Chart.yaml
    - chart/values.yaml
    - chart/templates/_helpers.tpl
    - chart/templates/deployment.yaml
    - chart/templates/service.yaml
    - chart/templates/pvc.yaml
    - chart/templates/httproute.yaml
    - chart/templates/certificate.yaml
    - chart/templates/configmap.yaml
    - chart/templates/NOTES.txt
  modified: []

key-decisions:
  - "existingSecret pattern for admin password -- Secret created externally, chart references it"
  - "Recreate deployment strategy -- SQLite single-writer constraint prevents rolling updates"
  - "helm.sh/resource-policy: keep on PVC -- prevents data loss on helm uninstall"
  - "cert-manager Certificate resource (not Gateway annotation) -- explicit, conditional on tls.enabled"
  - "Gateway API v1 HTTPRoute -- matches Cilium-based homelab cluster"

patterns-established:
  - "Helm values override pattern: sensible defaults in values.yaml, homelab-specific overrides in gitops repo"
  - "Conditional resources: tls.enabled, persistence.enabled, httpRoute.enabled gate optional templates"

requirements-completed: [INFR-01, INFR-02]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 4 Plan 02: Helm Chart Summary

**Helm chart with Deployment, Service, PVC, Gateway API HTTPRoute, cert-manager Certificate, and ConfigMap -- all templates render cleanly via helm template/lint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T19:56:27Z
- **Completed:** 2026-03-22T19:58:17Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete Helm chart in chart/ with 7 Kubernetes resource templates plus helpers and NOTES.txt
- PVC configured with ReadWriteOnce access mode and helm.sh/resource-policy: keep annotation for data safety
- Gateway API v1 HTTPRoute for Cilium ingress with configurable gateway name/namespace
- cert-manager Certificate resource for TLS (conditional on tls.enabled)
- All values have sensible defaults with clear override points for gitops

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart metadata, values, and helpers** - `6ab8814` (feat)
2. **Task 2: Kubernetes resource templates** - `f37d7cd` (feat)

## Files Created/Modified
- `chart/Chart.yaml` - Chart metadata (kubecon-guestbook v0.1.0)
- `chart/values.yaml` - Default configuration with override points for image, persistence, httpRoute, tls, resources
- `chart/templates/_helpers.tpl` - Standard helpers (fullname, labels, selectorLabels, image)
- `chart/templates/deployment.yaml` - Pod spec with Recreate strategy, PVC mount, health probes, Secret/ConfigMap refs
- `chart/templates/service.yaml` - ClusterIP service exposing port 8080
- `chart/templates/pvc.yaml` - PersistentVolumeClaim with keep annotation and configurable storageClass
- `chart/templates/httproute.yaml` - Gateway API v1 HTTPRoute with configurable gateway reference
- `chart/templates/certificate.yaml` - cert-manager Certificate for TLS issuance
- `chart/templates/configmap.yaml` - Non-secret env vars (BASE_URL, ADDR)
- `chart/templates/NOTES.txt` - Post-install instructions

## Decisions Made
- Used existingSecret pattern for admin password (chart does not create the Secret)
- Recreate strategy for Deployment (SQLite single-writer, no concurrent pods)
- PVC annotated with helm.sh/resource-policy: keep to prevent data loss on uninstall
- cert-manager Certificate as explicit resource (conditional) rather than Gateway annotation
- NOTES.txt uses structured kubectl commands for status checking and health verification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Helm chart is complete and ready for deployment via ArgoCD or direct helm install
- CI workflow (Plan 03) can reference this chart for automated deployments
- The chart is portable: works with default values for standalone use, override with gitops for homelab

## Self-Check: PASSED

All 10 created files verified present. Both task commits (6ab8814, f37d7cd) verified in git log.

---
*Phase: 04-deployment-validation*
*Completed: 2026-03-22*
