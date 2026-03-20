---
phase: 01-server-core-submission-form
plan: 02
subsystem: ui
tags: [preact, vite, typescript, mobile-first, dark-theme, embedded-assets]

# Dependency graph
requires:
  - phase: 01-server-core-submission-form/01
    provides: "Go HTTP server with REST API, SSE, embed.go for frontend assets"
provides:
  - "Preact mobile-first submission form with country dropdown, homelab scale, and K8s-themed UX"
  - "Build integration: Vite builds into web/dist, Go embeds via go:embed all:web/dist"
  - "Single-binary deployment serving both API and frontend"
  - "localStorage persistence preventing duplicate submissions"
affects: [02-visualization-engine, 03-admin-panel, 04-deployment-validation]

# Tech tracking
tech-stack:
  added: [preact, "@preact/signals", "@preact/preset-vite", vite, typescript]
  patterns: [Preact signals for global state, mobile-first CSS custom properties, native select with optgroups, single-binary embed]

key-files:
  created:
    - web/package.json
    - web/tsconfig.json
    - web/vite.config.ts
    - web/index.html
    - web/src/main.tsx
    - web/src/app.tsx
    - web/src/api.ts
    - web/src/style.css
    - web/src/data/countries.ts
    - web/src/components/SubmissionForm.tsx
    - web/src/components/CountrySelect.tsx
    - web/src/components/HomelabScale.tsx
    - web/src/components/Confirmation.tsx
    - web/src/components/ErrorBanner.tsx
    - web/src/components/SubmitButton.tsx
    - web/src/components/TextInput.tsx
  modified:
    - Makefile
    - embed.go

key-decisions:
  - "Used Preact with @preact/signals for global form state (formState, submissionData) -- lightweight reactivity without Redux-style boilerplate"
  - "Native HTML select with optgroups for country dropdown -- avoids custom dropdown JS, works perfectly on mobile"
  - "localStorage persistence to prevent duplicate submissions on page reload"
  - "Bundle size 14.8KB gzipped (JS 13.2KB + CSS 1.6KB) -- well under 50KB target"

patterns-established:
  - "Preact signal-based state: formState and submissionData signals in app.tsx drive form/confirmation view switching"
  - "Component props pattern: each component accepts typed props, no direct signal access in children"
  - "CSS custom properties for design tokens: --color-*, --space-*, --font-* variables in :root"
  - "Mobile-first CSS with 400px max-width card container, 48px touch targets"
  - "API client with typed error class (SubmissionError) carrying field name and HTTP status"

requirements-completed: [SUBM-02, SUBM-03, SUBM-04, SUBM-05, SUBM-06, INFR-04]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 1 Plan 2: Submission Form Summary

**Preact mobile-first submission form with dark K8s theme, European-priority country dropdown, 5-level homelab emoji scale, "kubectl apply" submit flow, and single-binary Go embed -- 14.8KB gzipped**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T20:53:56Z
- **Completed:** 2026-03-20T21:00:36Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 19

## Accomplishments
- Complete Preact frontend with 6 components: SubmissionForm, CountrySelect, HomelabScale, Confirmation, ErrorBanner, SubmitButton, plus TextInput
- Dark K8s-themed CSS with mobile-first design: slate-900 background (#0F172A), sky-400 accent (#38BDF8), 48px touch targets, 400px max-width card
- Country dropdown with European countries prioritized under "Europe" optgroup, all others under "Other countries"
- Homelab scale with 5 emoji levels and tap-to-reveal descriptions
- Full submission flow: form -> "kubectl apply" button -> "Deploying..." spinner -> "Pod deployed!" confirmation with emoji, namespace, status
- Build integration: `make build` produces single Go binary with embedded Preact frontend (14.8KB gzipped)
- End-to-end smoke test verified: health check, frontend serving, submission creation, QR code generation
- Human verification confirmed mobile UX, form flow, localStorage persistence, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Vite project scaffolding, components, country data, and CSS** - `6ec2df7` (feat)
2. **Task 2: Build integration, embed verification, and smoke test** - `8562bc6` (chore)
3. **Task 3: Verify submission form on mobile** - checkpoint:human-verify (approved, no commit needed)

## Files Created/Modified
- `web/package.json` - Preact + Vite project with @preact/signals
- `web/tsconfig.json` - TypeScript config with Preact JSX transform
- `web/vite.config.ts` - Vite config with Preact plugin and /api proxy
- `web/index.html` - Entry HTML with mobile viewport meta
- `web/src/main.tsx` - Preact render entry point
- `web/src/app.tsx` - Root component with formState/submissionData signals, localStorage check
- `web/src/api.ts` - Fetch wrapper for POST /api/submissions with typed SubmissionError
- `web/src/style.css` - Full dark theme CSS with design tokens, animations, reduced-motion support
- `web/src/data/countries.ts` - 249 ISO 3166-1 countries with European prioritization
- `web/src/components/SubmissionForm.tsx` - Main form with validation, submission, error handling
- `web/src/components/CountrySelect.tsx` - Native select with Europe/Other optgroups
- `web/src/components/HomelabScale.tsx` - 5-level emoji scale with descriptions
- `web/src/components/Confirmation.tsx` - "Pod deployed!" screen with emoji, namespace, status
- `web/src/components/ErrorBanner.tsx` - Dismissible error alert with auto-dismiss
- `web/src/components/SubmitButton.tsx` - "kubectl apply" / "Deploying..." button
- `web/src/components/TextInput.tsx` - Accessible text input with error state
- `Makefile` - Updated with build-web, dev-web, dev-server targets
- `embed.go` - Updated to use `all:web/dist` prefix

## Decisions Made
- Used Preact with @preact/signals for lightweight global state management -- signals provide reactivity without Redux boilerplate, and Preact keeps bundle tiny
- Chose native HTML `<select>` with `<optgroup>` for country dropdown instead of a custom component -- works perfectly on mobile with OS-native picker
- localStorage persistence prevents duplicate submissions on page reload
- Bundle came in at 14.8KB gzipped (JS 13.2KB + CSS 1.6KB), well under the 50KB INFR-04 target

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: full end-to-end pipeline working (mobile form -> API -> SQLite -> SSE broadcast)
- Single binary serves everything -- ready for Phase 4 containerization
- SSE stream ready for Phase 2 visualization engine to consume
- Admin panel (Phase 3) can toggle submissions via existing server flags

## Self-Check: PASSED

All 18 files verified present. Both commit hashes (6ec2df7, 8562bc6) verified in git log.

---
*Phase: 01-server-core-submission-form*
*Completed: 2026-03-20*
