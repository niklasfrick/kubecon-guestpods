---
phase: quick
plan: 260323-k4t
subsystem: ci
tags: [github-actions, docker, ci-fix]
dependency_graph:
  requires: []
  provides: [reliable-docker-image-tagging]
  affects: [release-pipeline]
tech_stack:
  added: []
  patterns: [sha-fallback-tag]
key_files:
  created: []
  modified:
    - .github/workflows/release.yaml
decisions:
  - Added type=sha as fallback tag to guarantee non-empty tags output from metadata-action
metrics:
  duration_seconds: 31
  completed: "2026-03-23T13:32:21Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Quick Task 260323-k4t: Fix GitHub Actions Build Pipeline Missing Tags

**One-liner:** Added SHA-based fallback tag to docker/metadata-action so build-and-push always receives at least one valid image tag.

## What Changed

The release workflow (`release.yaml`) relied exclusively on `type=semver` patterns in the `docker/metadata-action` step. These patterns only produce output when the git tag strictly matches semver format (e.g., `v1.2.3`). If the tag format is slightly off, the metadata action returns empty strings, causing `docker/build-push-action` to fail with "tag is needed when pushing to registry".

**Fix:** Added `type=sha,prefix=,format=short` to the metadata-action tags configuration. This guarantees at least one tag (the short commit SHA) is always produced, regardless of the git tag format. The existing semver patterns are preserved so proper version tags still work when the git tag matches.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix metadata-action tag patterns and add fallback tag | 182d77a | .github/workflows/release.yaml |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `type=sha` pattern present in release.yaml: PASS
- `type=semver,pattern={{version}}` preserved: PASS
- `type=semver,pattern={{major}}.{{minor}}` preserved: PASS
- Build-and-push step references `steps.meta.outputs.tags`: PASS
- YAML syntax valid: PASS

## Self-Check: PASSED

- .github/workflows/release.yaml: FOUND
- Commit 182d77a: FOUND
- SUMMARY.md: FOUND
