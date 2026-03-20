# Requirements: KubeCon Guestbook

**Defined:** 2026-03-20
**Core Value:** Attendees see themselves appear in real-time as pods in a K8s cluster visualization, creating a shared interactive moment during the talk.

## v1 Requirements

Requirements for the live KubeCon talk. Each maps to roadmap phases.

### Submission

- [ ] **SUBM-01**: Attendee can access the guestbook via QR code displayed on a presentation slide
- [ ] **SUBM-02**: Attendee can access the guestbook via a short memorable URL (e.g., kubecon.niklas.dev)
- [ ] **SUBM-03**: Attendee can submit their name on a mobile-friendly form
- [ ] **SUBM-04**: Attendee can select their location from a pre-defined dropdown
- [ ] **SUBM-05**: Attendee can select a homelab emoji from a curated grid of 15-25 themed emojis
- [ ] **SUBM-06**: Attendee sees a "You're now a pod in the cluster!" confirmation after submitting
- [ ] **SUBM-07**: Name field is filtered against a profanity blocklist before accepting submission

### Visualization

- [ ] **VIZZ-01**: New submissions appear as pods on the visualization screen within 1-2 seconds via SSE
- [ ] **VIZZ-02**: Pods are grouped into namespace clusters based on attendee location
- [ ] **VIZZ-03**: Namespace clusters are labeled with K8s-style naming (e.g., ns/berlin, ns/london)
- [ ] **VIZZ-04**: New pods animate in smoothly (fade/slide entrance animation)
- [ ] **VIZZ-05**: Pods use K8s-themed visual language (rounded-rect shapes, status indicators, labels)
- [ ] **VIZZ-06**: Pods display the attendee's name and selected emoji
- [ ] **VIZZ-07**: Pods arrange organically within namespace boundaries using D3 force simulation
- [ ] **VIZZ-08**: Live stats overlay shows total pod count and namespace count on the visualization
- [ ] **VIZZ-09**: Presenter can hover over pods to see full attendee details (name, location, emoji)
- [ ] **VIZZ-10**: Visualization handles 100-500 pods without performance degradation

### Admin

- [ ] **ADMN-01**: Admin can open and close submissions with a single toggle button
- [ ] **ADMN-02**: Admin panel shows real-time stats (total submissions, submissions over time, top locations)
- [ ] **ADMN-03**: Admin can delete individual pod entries for reactive moderation
- [ ] **ADMN-04**: Guestbook transitions to read-only mode when submissions are closed (post-talk artifact)
- [ ] **ADMN-05**: Admin panel is protected by authentication (simple password or shared secret)

### Infrastructure

- [ ] **INFR-01**: Application is containerized and deployable on a homelab Kubernetes cluster
- [ ] **INFR-02**: Data persists across pod restarts (survives redeployment)
- [ ] **INFR-03**: Application handles burst traffic of 500 concurrent submissions within 60 seconds
- [ ] **INFR-04**: Submission form page loads in under 2 seconds on 4G / conference WiFi

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Polish

- **PLSH-01**: Toggle-able sound effect when new pods appear on visualization
- **PLSH-02**: Pre-recorded fallback video of the visualization for catastrophic failure scenario
- **PLSH-03**: OpenGraph meta image for social sharing when the guestbook URL is shared

## Out of Scope

| Feature | Reason |
|---------|--------|
| Free-text messages / comments | Content moderation risk during live talk; emoji selector replaces this |
| Chat between attendees | Not a chat app — conference Slack/Discord exists for that |
| Authentication for attendees | Friction kills participation; 60-80% drop-off with login |
| Full emoji keyboard | Content risk and UI bloat; curated set is the feature |
| Multi-event support | Premature generalization; fork the repo for future talks |
| Real-time editing of submissions | Adds bidirectional sync complexity; one-shot submission is fine |
| Gamification / leaderboard | Undermines inclusive "we're all in this cluster" vibe |
| Moderation queue | Constrained inputs (dropdown + emoji grid) make it unnecessary |
| Social media sharing from app | OAuth complexity; attendees can screenshot instead |
| Mobile app | Web-only, accessed via QR/URL |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SUBM-01 | — | Pending |
| SUBM-02 | — | Pending |
| SUBM-03 | — | Pending |
| SUBM-04 | — | Pending |
| SUBM-05 | — | Pending |
| SUBM-06 | — | Pending |
| SUBM-07 | — | Pending |
| VIZZ-01 | — | Pending |
| VIZZ-02 | — | Pending |
| VIZZ-03 | — | Pending |
| VIZZ-04 | — | Pending |
| VIZZ-05 | — | Pending |
| VIZZ-06 | — | Pending |
| VIZZ-07 | — | Pending |
| VIZZ-08 | — | Pending |
| VIZZ-09 | — | Pending |
| VIZZ-10 | — | Pending |
| ADMN-01 | — | Pending |
| ADMN-02 | — | Pending |
| ADMN-03 | — | Pending |
| ADMN-04 | — | Pending |
| ADMN-05 | — | Pending |
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |
| INFR-03 | — | Pending |
| INFR-04 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
