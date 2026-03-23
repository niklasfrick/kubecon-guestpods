# Phase 1: Server Core + Submission Form - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end data pipeline: monorepo with Go server and Preact frontend, SQLite database, REST API, SSE broadcaster, and mobile-friendly submission form. Attendees open a URL on their phone, submit name + country + homelab level, and the submission flows through the system (API receives it, persists it, broadcasts it via SSE).

</domain>

<decisions>
## Implementation Decisions

### Emoji grid — Homelab maturity scale
- NOT a free-choice emoji grid — it's a 5-level homelab maturity scale
- Levels:
  1. 💭 "What's a homelab?"
  2. 🍓 "A Pi and a dream"
  3. 🖥️ "The spare laptop era"
  4. 🗄️ "My partner asks about the electricity bill"
  5. 🚀 "I have an on-call rotation for my house"
- Displayed as a horizontal scale on mobile (like a slider/segmented control)
- Tapping an emoji shows its description below the scale; descriptions are NOT always visible
- This replaces the original "curated grid of 15-25 emojis" concept from requirements

### Location options
- Full list of all countries (not curated subset)
- Smart ordering: European countries at top, search/filter capability
- Namespace labels use flag emoji + country code: 🇩🇪 ns/DE, 🇬🇧 ns/UK
- Every country gets its own namespace, even with 1 attendee (no "other" bucket)

### Submission form layout
- Single page — all fields visible at once (name, country dropdown, emoji scale, submit button)
- No multi-step wizard — speed matters when 500 people submit at once
- Submit button text: "kubectl apply" (K8s-themed language)
- Form field labels: "Your name", "Where are you from?", "Homelab level"

### Post-submission confirmation
- Form is replaced entirely by a K8s-style confirmation:
  - "Pod deployed!" with checkmark
  - Shows attendee's emoji, name, and namespace (e.g., 🍓 niklas, ns/germany)
  - "Status: Running"
  - "Look up at the screen to find yourself!"
- No way to re-submit or edit — one submission per visitor

### Closed state behavior
- When submissions are closed, visiting the form URL redirects to the visualization page
- No separate "closed" message page

### Tech stack
- Server: Go with standard library (net/http)
- Frontend: Preact + Vite + TypeScript (monorepo structure)
- Database: SQLite (single file, PVC-backed in K8s)
- Real-time: SSE (server-sent events) for broadcasting new submissions
- Profanity filter: Server-side blocklist check on name field

### Claude's Discretion
- CSS framework / styling approach for the form
- Exact country list source and ordering algorithm
- Profanity blocklist source and implementation
- QR code generation approach
- SSE event format and API endpoint design
- SQLite schema design
- Monorepo directory structure details
- Error states and validation UX

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in the decisions above and in `.planning/REQUIREMENTS.md` (SUBM-01 through SUBM-07, INFR-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the patterns for the project

### Integration Points
- SSE broadcaster must be designed for Phase 2 (visualization) to consume
- Location data model must support Phase 2 namespace clustering with flag emoji + country code
- Submission toggle endpoint needed for Phase 3 (admin panel)

</code_context>

<specifics>
## Specific Ideas

- Emoji scale represents homelab maturity, NOT random homelab equipment — this is a deliberate design choice that adds personality and makes it a conversation starter
- K8s-themed language throughout: "kubectl apply" button, "Pod deployed!" confirmation, "Status: Running"
- The confirmation message directs attendees to look at the big screen — bridging the phone experience to the live visualization
- Country code format with flag emojis (🇩🇪 ns/DE) ties into the K8s namespace metaphor

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-server-core-submission-form*
*Context gathered: 2026-03-20*
