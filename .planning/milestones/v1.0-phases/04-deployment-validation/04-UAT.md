---
status: complete
phase: 04-deployment-validation
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start fresh with `go run .` — server boots without errors, SQLite database initializes, and visiting http://localhost:8080 loads the guestbook page with the submission form.
result: pass

### 2. SSE Keep-Alive Behavior
expected: Open the app in a browser and open DevTools Network tab. Filter by EventSource/SSE. The SSE connection should stay open. If you wait ~30s, you should see `: keepalive` comments arriving in the event stream (visible in the response preview). The connection should not drop.
result: pass

### 3. Graceful Shutdown
expected: With the server running via `go run .`, send Ctrl+C (SIGINT). The server should log a clean shutdown message and exit with code 0 — no panics, no "connection refused" errors, no orphaned goroutines.
result: pass

### 4. Dockerfile Builds Successfully
expected: Run `docker build -t kubecon-guestbook .` — the three-stage build completes: Node builds frontend assets, Go compiles the binary, and the final image is based on distroless. The build should finish without errors. (Skip if Docker is not installed.)
result: pass

### 5. Helm Chart Renders Cleanly
expected: Run `helm template test chart/` — all 7 templates render valid YAML (Deployment, Service, PVC, HTTPRoute, Certificate, ConfigMap, NOTES). Run `helm lint chart/` — no errors or warnings. (Skip if Helm is not installed.)
result: pass

### 6. CI Release Workflow Structure
expected: Review `.github/workflows/release.yaml` — it should trigger on tag push matching `v*`, use docker/build-push-action to build the multi-stage Dockerfile, push to `ghcr.io`, and tag images with semver versions from the git tag.
result: pass

### 7. k6 Load Test Script Structure
expected: Review `loadtest/submissions.js` — it should configure 500 concurrent VUs with a ramping-vus executor, include a setup() health check, use configurable BASE_URL (default localhost:8080), and define pass/fail thresholds for error rate and latency.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
