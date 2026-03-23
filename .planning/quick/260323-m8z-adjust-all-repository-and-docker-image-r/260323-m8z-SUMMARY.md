---
phase: quick
plan: 260323-m8z
subsystem: infra
tags: [go-module, helm, docker, repository-rename]

# Dependency graph
requires: []
provides:
  - "All source code references point to niklasfrick/kubecon-guestpods"
  - "Docker image repository uses ghcr.io/niklasfrick/kubecon-guestpods"
  - "Helm chart renders with guestpods naming"
affects: [deployment, ci-cd]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - go.mod
    - main.go
    - chart/Chart.yaml
    - chart/values.yaml
    - chart/templates/_helpers.tpl
    - chart/templates/deployment.yaml
    - chart/templates/service.yaml
    - chart/templates/pvc.yaml
    - chart/templates/configmap.yaml
    - chart/templates/httproute.yaml
    - chart/templates/NOTES.txt
    - web/package.json
    - web/package-lock.json

key-decisions: []

patterns-established: []

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-23
---

# Quick Task 260323-m8z: Adjust Repository and Docker Image References Summary

**Full rename from kubecon-guestbook to kubecon-guestpods across Go module, Helm chart, Docker image, and web package**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T15:04:16Z
- **Completed:** 2026-03-23T15:06:19Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Go module path changed to github.com/niklasfrick/kubecon-guestpods with passing build and tests
- Helm chart fully renamed: Chart.yaml name, values.yaml image repo, all template helpers from guestbook.* to guestpods.*
- Web package name updated in package.json and package-lock.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Go module path and imports** - `8a8bf72` (feat)
2. **Task 2: Update Helm chart naming and Docker image reference** - `5af5c63` (feat)
3. **Task 3: Update web package name** - `25574cd` (feat)

## Files Created/Modified
- `go.mod` - Module path changed to github.com/niklasfrick/kubecon-guestpods
- `main.go` - Import path updated to match new module
- `chart/Chart.yaml` - Chart name changed to kubecon-guestpods
- `chart/values.yaml` - Docker image repository changed to ghcr.io/niklasfrick/kubecon-guestpods
- `chart/templates/_helpers.tpl` - All template definitions renamed from guestbook.* to guestpods.*
- `chart/templates/deployment.yaml` - Template includes and container name updated
- `chart/templates/service.yaml` - Template includes updated
- `chart/templates/pvc.yaml` - Template includes updated
- `chart/templates/configmap.yaml` - Template includes updated
- `chart/templates/httproute.yaml` - Template includes updated
- `chart/templates/NOTES.txt` - Template includes and display text updated
- `web/package.json` - Package name changed to kubecon-guestpods-web
- `web/package-lock.json` - Package name changed to kubecon-guestpods-web

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All 13 modified files verified present. All 3 task commits verified in git log.

---
*Quick Task: 260323-m8z*
*Completed: 2026-03-23*
