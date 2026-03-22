---
phase: 04-deployment-validation
plan: 03
subsystem: infra
tags: [github-actions, ghcr, docker, k6, load-testing, ci-cd]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Dockerfile multi-stage build, SSE keep-alive, graceful shutdown"
provides:
  - "GitHub Actions release workflow: tag push -> Docker build -> push to ghcr.io"
  - "k6 load test script for 500 concurrent submission burst validation"
affects: []

# Tech tracking
tech-stack:
  added: [docker/build-push-action@v7, docker/metadata-action@v6, docker/login-action@v3, docker/setup-buildx-action@v3, actions/checkout@v5, k6]
  patterns: [semver-tag-triggered-ci, gha-native-layer-caching, ramping-vus-load-test]

key-files:
  created:
    - .github/workflows/release.yaml
    - loadtest/submissions.js
  modified: []

key-decisions:
  - "GHA cache (type=gha,mode=max) for Docker layer caching -- zero-config, GitHub-native"
  - "ramping-vus executor with 10s ramp + 50s hold for realistic audience surge simulation"

patterns-established:
  - "CI release pattern: tag push v* triggers build-and-push, metadata-action generates semver tags"
  - "Load test pattern: setup() health check, configurable BASE_URL, custom metrics tracking"

requirements-completed: [INFR-01, INFR-03]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 4 Plan 3: CI/CD Pipeline and Load Test Summary

**GitHub Actions release workflow for automated GHCR image builds on semver tag push, plus k6 load test validating 500 concurrent submissions within 60 seconds**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T20:06:59Z
- **Completed:** 2026-03-22T20:09:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GitHub Actions release workflow triggers on semver tag push (v*), builds multi-stage Docker image, and pushes to ghcr.io with proper semver tags
- k6 load test script simulates 500 concurrent VUs submitting over 60 seconds with realistic payloads, configurable BASE_URL, and pass/fail thresholds
- Both artifacts are self-contained and production-ready with no additional configuration needed

## Task Commits

Each task was committed atomically:

1. **Task 1: GitHub Actions release workflow** - `bcbce7f` (feat)
2. **Task 2: k6 load test script for 500 concurrent submissions** - `15a396e` (feat)

## Files Created/Modified
- `.github/workflows/release.yaml` - CI/CD pipeline: tag push triggers Docker build and push to ghcr.io with semver tags
- `loadtest/submissions.js` - k6 load test: 500 concurrent VUs, ramping-vus executor, thresholds for error rate and latency

## Decisions Made
- GHA native layer caching (type=gha, mode=max) for Docker builds -- zero-config and integrated with GitHub Actions
- ramping-vus executor with 10s ramp to 500 VUs + 50s hold -- mirrors realistic audience surge when QR code is displayed
- localhost:8080 as default BASE_URL with -e override for live deployment testing through Cloudflare

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 is now fully complete: app hardening + Dockerfile (plan 01), Helm chart (plan 02), CI/CD + load tests (plan 03)
- To release: push a semver tag (e.g., `git tag v1.0.0 && git push origin v1.0.0`) to trigger automated image build
- To load test: `k6 run -e BASE_URL=https://guestbook.example.com loadtest/submissions.js`

## Self-Check: PASSED

All files and commits verified:
- .github/workflows/release.yaml: FOUND
- loadtest/submissions.js: FOUND
- 04-03-SUMMARY.md: FOUND
- Commit bcbce7f: FOUND
- Commit 15a396e: FOUND

---
*Phase: 04-deployment-validation*
*Completed: 2026-03-22*
