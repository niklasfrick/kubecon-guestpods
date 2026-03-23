---
phase: quick
plan: 260323-ly6
subsystem: infra
tags: [helm, kubernetes, gateway-api, cert-manager, extraobjects]

requires:
  - phase: 04-deployment
    provides: "Helm chart with deployment, service, HTTPRoute, and Certificate templates"
provides:
  - "Helm chart without cert-manager dependency"
  - "HTTPRoute annotations support for external-dns/cert-manager gateway-shim"
  - "extraObjects for deploying arbitrary K8s manifests alongside the chart"
affects: [deployment, infrastructure]

tech-stack:
  added: []
  patterns: ["extraObjects pattern for arbitrary manifest injection"]

key-files:
  created:
    - chart/templates/extraobjects.yaml
  modified:
    - chart/values.yaml
    - chart/templates/httproute.yaml
  deleted:
    - chart/templates/certificate.yaml

key-decisions:
  - "TLS handled by gateway/infrastructure layer, not chart-managed Certificate resource"
  - "extraObjects uses simple range/toYaml pattern for maximum flexibility"

patterns-established:
  - "extraObjects: list of arbitrary K8s manifests rendered as separate documents"
  - "Optional annotations via with/toYaml pattern on HTTPRoute metadata"

requirements-completed: [quick-260323-ly6]

duration: 1min
completed: 2026-03-23
---

# Quick Task 260323-ly6: Update Helm Chart - Remove Cert/TLS Config Summary

**Removed cert-manager Certificate resource, added HTTPRoute annotations and extraObjects for flexible infrastructure integration**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-23T14:50:22Z
- **Completed:** 2026-03-23T14:51:48Z
- **Tasks:** 2
- **Files modified:** 3 (1 deleted, 1 created, 2 modified)

## Accomplishments
- Removed cert-manager Certificate template and TLS values, simplifying chart for gateway-level TLS
- Added optional annotations on HTTPRoute for external-dns and cert-manager gateway-shim integration
- Added extraObjects value enabling arbitrary Kubernetes manifests alongside the chart

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove TLS/cert-manager config and delete Certificate template** - `13e5535` (feat)
2. **Task 2: Add annotations support to HTTPRoute and create extraObjects template** - `5e3e155` (feat)

## Files Created/Modified
- `chart/templates/certificate.yaml` - Deleted (cert-manager Certificate resource no longer chart-managed)
- `chart/values.yaml` - Removed tls: section, added httpRoute.annotations and extraObjects
- `chart/templates/httproute.yaml` - Added optional annotations rendering via with/toYaml
- `chart/templates/extraobjects.yaml` - Created: iterates extraObjects list, renders each as K8s manifest

## Decisions Made
- TLS is delegated to the Gateway/infrastructure layer rather than managed by a chart-level Certificate resource
- extraObjects uses the simple range/toYaml pattern (same as used by many popular Helm charts like prometheus, grafana)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Steps
- Users needing TLS can configure it via gateway annotations or extraObjects
- Consider documenting example values for common setups (cert-manager gateway-shim, external-dns)

## Self-Check: PASSED

All files verified, all commits found.

---
*Quick Task: 260323-ly6*
*Completed: 2026-03-23*
