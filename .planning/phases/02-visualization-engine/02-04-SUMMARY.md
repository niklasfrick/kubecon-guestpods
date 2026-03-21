---
phase: 02-visualization-engine
plan: 04
subsystem: viz
tags: [d3-force, canvas, convex-hull, cluster-separation, quadratic-curves]

# Dependency graph
requires:
  - phase: 02-visualization-engine
    provides: "Force simulation with cluster grouping and convex hull rendering"
provides:
  - "Inter-cluster repulsion force (clusterRepulsionForce) preventing namespace overlap"
  - "Tuned simulation parameters for balanced cluster spreading"
  - "Smooth rounded hull boundaries via quadratic curve interpolation"
affects: [02-visualization-engine, 03-admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: ["cluster-level repulsion force pairwise O(k^2) over cluster centroids", "quadratic curve smoothing on convex hull vertices"]

key-files:
  created: []
  modified:
    - web/src/viz/clusterForce.ts
    - web/src/viz/simulation.ts
    - web/src/viz/renderer.ts

key-decisions:
  - "clusterRepulsionForce uses pairwise centroid distance with size-scaled minDistance for proportional spacing"
  - "Hull smoothing via midpoint-quadraticCurveTo loop rather than cubic bezier for simplicity and fewer control points"
  - "Increased precompute ticks from 120 to 200 to give stronger forces time to settle"

patterns-established:
  - "Cluster-level forces operate on centroid aggregates then distribute velocity equally to member nodes"

requirements-completed: [VIZZ-02, VIZZ-03, VIZZ-07]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 2 Plan 4: Cluster Overlap Fix Summary

**Inter-cluster repulsion force with size-scaled minimum distance and smooth quadratic-curve hull boundaries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T23:17:58Z
- **Completed:** 2026-03-21T23:19:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added clusterRepulsionForce that pushes namespace clusters apart when centroids are closer than a size-scaled minimum distance, preventing hull and label overlap
- Tuned simulation parameters (stronger charge, larger collide radius, reduced centering forces) to give clusters room to spread
- Replaced sharp-cornered convex hull paths with smooth quadratic curve interpolation for polished cluster boundaries
- Increased hull padding from 25px to 35px for more visual breathing room

## Task Commits

Each task was committed atomically:

1. **Task 1: Add inter-cluster repulsion force and tune simulation parameters** - `269c3d8` (feat)
2. **Task 2: Smooth hull corners and increase hull padding for visual clarity** - `766c5db` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `web/src/viz/clusterForce.ts` - Added clusterRepulsionForce export: pairwise centroid repulsion with size-scaled minDistance
- `web/src/viz/simulation.ts` - Imported clusterRepulsionForce, tuned charge/collide/center/x/y strengths, increased precompute ticks to 200
- `web/src/viz/renderer.ts` - Increased HULL_PADDING to 35, replaced lineTo hull loop with quadraticCurveTo smooth path

## Decisions Made
- clusterRepulsionForce uses pairwise centroid distance with size-scaled minDistance (`sqrt(a.count + b.count) * 0.5`) so larger clusters get proportionally more separation
- Hull smoothing uses midpoint-start + quadraticCurveTo loop (simpler than cubic bezier, fewer control points to manage)
- Increased precompute ticks from 120 to 200 to give stronger repulsion forces time to settle before visual cascade

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Cluster separation forces active; clusters will spread to use available canvas space
- Hull rendering produces smooth rounded boundaries for professional appearance
- Ready for plan 02-05 (pan/zoom) or phase 3 (admin panel)

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 02-visualization-engine*
*Completed: 2026-03-21*
