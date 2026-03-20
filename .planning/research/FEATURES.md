# Feature Research

**Domain:** Live audience participation / interactive conference guestbook with K8s-style visualization
**Researched:** 2026-03-20
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that attendees and the presenter assume work flawlessly. Missing any of these would make the product feel broken during a live talk -- and there are no second chances.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile-friendly submission form | Attendees use phones. A form that doesn't work on mobile is a non-starter. QR-to-form is the standard pattern across Slido, Mentimeter, and every audience participation tool. | LOW | Single-page form: name, location (dropdown/autocomplete), emoji picker. No scrolling, no login. Must render in under 2 seconds on 4G. |
| QR code + short URL for access | Every audience engagement tool (Slido, Mentimeter, Kahoot) uses QR + short URL. Attendees expect to scan and go. 3-4x higher engagement vs typed URLs. | LOW | Generate QR server-side or at build time. Display prominently on a dedicated slide. Short URL like `kubecon.niklas.dev` is essential. |
| Real-time visualization updates | The entire value proposition. When an attendee submits, they expect to see themselves appear on screen within 1-2 seconds. Platforms like Guestbook.tv, Mentimeter word clouds, and Kahoot leaderboards all update in real-time. | HIGH | Server-Sent Events (SSE) is the right choice over WebSockets here: data flows server-to-client only for the visualization screen, SSE is simpler, works over standard HTTP, and handles 500 concurrent connections easily. The submission form only needs standard HTTP POST. |
| Pod-in animation for new entries | Without animation, new entries just "pop" into existence. Every real-time visualization tool uses entrance animations. Static appearance feels broken. | MEDIUM | CSS/SVG transitions for pod appearance. Stagger animations when multiple entries arrive simultaneously to avoid visual chaos. |
| Namespace grouping by location | The core K8s metaphor. Without grouping, it's just scattered dots -- not a cluster visualization. This is what makes it a "Kubernetes visualization" vs a generic wall of names. | MEDIUM | Location-based clustering with visual boundaries. Namespace labels should use K8s naming convention (e.g., `ns/london`, `ns/berlin`). Need a sensible strategy for locations: pre-defined list of common ones + "other" bucket to prevent fragmentation. |
| Frictionless entry (no auth) | Audience participation tools that require login see 60-80% drop-off. Slido, Mentimeter, Kahoot -- none require auth for participants. Project scope explicitly states "no authentication." | LOW | No login, no email, no sign-up. Just name + location + emoji and submit. Consider localStorage to prevent accidental duplicate submissions from same device. |
| Admin submission toggle (open/close) | The presenter needs to control when submissions start and stop. Every event tool has this. Critical for the live talk flow: show QR, open submissions, close when done. | LOW | Simple toggle in admin panel. Could also auto-close after a timeout. Must be operable under stage pressure (big buttons, clear state). |
| Submission confirmation feedback | Users who submit a form and see nothing happen will submit again. Standard UX pattern: show a success state. | LOW | After submit: show "You're now a pod in the cluster!" confirmation with the user's pod identity. Optionally show a link to the visualization. |
| Data persistence | The guestbook is meant to be a lasting artifact. The project spec requires it survives beyond the talk. | LOW | Any persistent store works (SQLite, PostgreSQL). Not ephemeral -- must survive pod restarts on the homelab cluster. |

### Differentiators (Competitive Advantage)

Features that make this memorable and unique. These transform it from "another audience tool" into a talk-defining moment that attendees remember and share.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| K8s-themed visual language | Pods with hexagonal or rounded-rect shapes, namespace boundaries styled like K8s dashboards (KubeView, kube-ops-view), status indicators (green = Running), K8s-style labels. No other audience tool looks like a Kubernetes cluster. This IS the differentiator. | MEDIUM | Borrow visual cues from KubeView (color coding: green/running pods, namespace grouping) and kube-ops-view (operational dashboard aesthetic). Don't replicate them -- create a stylized, presentation-friendly version. |
| Curated homelab emoji selector | Instead of free text (content moderation nightmare), attendees pick from a curated set of homelab/tech emojis (server rack, Raspberry Pi, router, container ship, whale, crab, gear, etc.). Fun, visual, on-brand, and inherently safe. | LOW | Pre-defined grid of 15-25 themed emojis. No need for a full emoji picker library -- just a simple grid of curated options. Each emoji represents a "homelab personality." |
| Smooth cluster layout with physics | Pods don't just sit in a grid -- they organically arrange within namespace boundaries with subtle motion, like a living cluster. Word clouds do this (grow/rearrange as entries arrive). Apply the same principle to pods. | HIGH | Force-directed or physics-based layout within namespace boundaries. D3.js force simulation is the standard approach. SVG is fine for 500 nodes (under the ~1000 threshold where Canvas becomes necessary). Add subtle idle animation (gentle floating/breathing). |
| Pod detail on hover/click (visualization screen) | On the big screen, the presenter can hover over pods to show attendee details (name, location, emoji). Creates interactive moments during the talk. "Let's see who's here from Berlin!" | LOW | Tooltip or side panel on the visualization screen. Only the presenter interacts with this -- attendees watch. |
| Live stats counter | "We have 247 pods running across 12 namespaces!" Real-time counters add energy and give the audience a sense of collective participation. Similar to how Kahoot shows participant count climbing. | LOW | Overlay on visualization: total pods, namespace count, submissions per minute. Animate the counter incrementing. |
| Post-talk read-only mode | After submissions close, the visualization remains as a permanent artifact. Attendees can revisit it, screenshot it, share it. Like a digital conference badge of "I was there." | LOW | Same visualization, no submission form. Add a timestamp/event title. Consider adding a "Presented at KubeCon Europe 2026" watermark. |
| Admin stats dashboard | Submission rate over time, top locations, total count. Useful during and after the talk. Goes beyond the simple toggle into actually useful operational data. | MEDIUM | Chart showing submissions over time (spike during QR reveal), location breakdown bar chart. Real-time updates. |
| Sound effect on new pod (optional) | A subtle "pod scheduled" sound when new entries arrive on the visualization screen. Adds another sensory dimension. Mentimeter and Kahoot use sound cues to great effect. | LOW | Must be toggle-able (admin can mute). Keep it subtle -- a soft chime or container-themed sound, not jarring. Web Audio API. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but would actively harm the product in this specific context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-text messages / comments | "Let people write a message!" | Content moderation nightmare during a live talk. One inappropriate message on the big screen ruins the moment. Slido and Mentimeter both warn about this. Moderation queue adds complexity and delay that kills the real-time magic. | Curated emoji selector. Constrained input = guaranteed safe output. The emoji IS the message. |
| Chat between attendees | "People want to talk to each other!" | This is a guestbook, not a chat room (explicitly out of scope). Chat requires moderation, adds UI complexity, and distracts from the talk. Every conference already has a chat channel (Slack, Discord). | Link to the conference Slack/Discord channel if social connection is desired. |
| Authentication / user accounts | "Track who signed in, prevent duplicates" | Friction kills participation. Even "sign in with Google" loses 30-50% of potential users. The 30-second window when attendees scan the QR is all you get -- don't waste it on auth flows. | localStorage duplicate check (same device). Accept that some people might submit twice -- it's a guestbook, not a voting system. Duplicates are harmless. |
| Full emoji keyboard | "Let people pick any emoji" | Many emojis are inappropriate, off-topic, or visually confusing at small sizes. A full picker adds UI weight to the mobile form. The curated set IS the feature. | Curated grid of 15-25 homelab/tech themed emojis. |
| Multi-event support | "What if you give more talks?" | Premature generalization. Adds database complexity, routing, admin UX for selecting events. Build for THIS talk. If there's a next talk, fork the repo. | Single-purpose deployment. The URL, the data, the visualization -- all for this one event. |
| Real-time editing of submissions | "Let people update their entry" | Adds bidirectional state sync complexity. Creates race conditions. Attendees don't need to update -- they submit once and watch. | One-shot submission. If they made a typo, it doesn't matter -- it's a fun guestbook, not a legal document. |
| Leaderboard / gamification | "Add points for being first! Badges!" | Detracts from the communal, inclusive vibe. The point is "we're all in this cluster together," not "who submitted fastest." Gamification creates winners and losers. | The visualization itself is the reward. Seeing yourself appear as a pod IS the moment. |
| Complex admin moderation queue | "Review every submission before it appears" | Introduces delay that kills the real-time experience. If submissions take 30 seconds to appear after review, the magic is gone. With constrained inputs (name + location dropdown + curated emoji), moderation risk is minimal. | Profanity filter on the name field (simple blocklist). Admin can delete individual pods after they appear (reactive, not proactive moderation). Location is a dropdown so it's pre-validated. |
| Social media sharing from the app | "Let people share their pod on Twitter!" | Adds OAuth complexity, API integrations, share dialogs. Attendees can screenshot the visualization themselves. The organic sharing is more authentic. | Make the visualization URL shareable. Add a meta image / OpenGraph card for when the URL is shared. |

## Feature Dependencies

```
[QR Code + Short URL]
    └──enables──> [Mobile Submission Form]
                      └──produces──> [Real-time Visualization]
                                         └──requires──> [SSE/WebSocket Connection]
                                         └──requires──> [Namespace Grouping Logic]
                                         └──requires──> [Pod Animation System]
                                         └──enhanced-by──> [Live Stats Counter]
                                         └──enhanced-by──> [Pod Detail on Hover]
                                         └──enhanced-by──> [Sound Effects]

[Admin Panel]
    └──controls──> [Submission Toggle (open/close)]
    └──displays──> [Admin Stats Dashboard]
    └──enables──> [Post-talk Read-only Mode]
    └──enables──> [Reactive Moderation (delete pod)]

[Curated Emoji Selector]
    └──replaces──> [Free-text Input] (anti-feature)
    └──eliminates──> [Content Moderation Queue] (anti-feature)

[Data Persistence]
    └──enables──> [Post-talk Read-only Mode]
    └──enables──> [Admin Stats Dashboard]

[Location Dropdown]
    └──feeds──> [Namespace Grouping Logic]
    └──eliminates──> [Location Fragmentation Problem]
```

### Dependency Notes

- **Mobile Submission Form requires QR Code + Short URL:** The form is useless without a fast way to reach it. The QR code is shown on a slide; the URL is the fallback for those who can't scan.
- **Real-time Visualization requires SSE Connection:** Without server-push, you'd need polling, which adds latency and server load. SSE is the right choice because data only flows server-to-client for the visualization.
- **Namespace Grouping requires Location Dropdown:** If location is free-text, you get "London", "london", "LONDON", "LDN", "UK" all as separate namespaces. A dropdown with pre-defined locations solves this.
- **Post-talk Read-only Mode requires Data Persistence:** Can't show a lasting artifact if submissions are in-memory only.
- **Curated Emoji Selector eliminates Content Moderation Queue:** This is the key architectural insight -- constrained input makes proactive moderation unnecessary.

## MVP Definition

### Launch With (v1) -- Must work for the live talk

- [x] Mobile-friendly submission form (name, location dropdown, emoji grid) -- the audience's entry point
- [x] QR code + short URL displayed on a slide -- how attendees find the form
- [x] Real-time visualization with pod animation -- the core spectacle
- [x] Namespace grouping by location -- the K8s metaphor
- [x] Curated homelab emoji selector -- safe, fun, on-brand input
- [x] Admin toggle to open/close submissions -- presenter control
- [x] Submission confirmation on the form -- "You're a pod now!"
- [x] Data persistence -- survives the talk
- [x] Basic profanity filter on name field -- safety net

### Add After Core Works (v1.x) -- Polish before the talk

- [ ] Live stats counter overlay -- adds energy to the visualization
- [ ] Pod detail on hover (visualization screen) -- presenter interaction
- [ ] Admin stats dashboard -- submission rate, location breakdown
- [ ] Post-talk read-only mode with event branding -- lasting artifact
- [ ] Sound effects toggle -- sensory enhancement
- [ ] Smooth physics-based layout -- visual polish (may need to start this earlier if grid layout looks too rigid)

### Not Building (anti-features)

- [ ] Chat, free-text messages, social sharing -- scope creep that adds risk
- [ ] Authentication, user accounts -- friction that kills participation
- [ ] Multi-event support -- premature generalization
- [ ] Full emoji keyboard -- content risk, UI bloat
- [ ] Moderation queue -- constrained inputs make it unnecessary

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mobile submission form | HIGH | LOW | P1 |
| QR code + short URL | HIGH | LOW | P1 |
| Real-time visualization (SSE) | HIGH | HIGH | P1 |
| Pod entrance animation | HIGH | MEDIUM | P1 |
| Namespace grouping by location | HIGH | MEDIUM | P1 |
| Curated emoji selector | MEDIUM | LOW | P1 |
| Admin submission toggle | HIGH | LOW | P1 |
| Submission confirmation | MEDIUM | LOW | P1 |
| Data persistence | HIGH | LOW | P1 |
| Profanity filter (name field) | MEDIUM | LOW | P1 |
| K8s visual theme/styling | HIGH | MEDIUM | P1 |
| Live stats counter | MEDIUM | LOW | P2 |
| Pod detail on hover | LOW | LOW | P2 |
| Admin stats dashboard | LOW | MEDIUM | P2 |
| Post-talk read-only mode | MEDIUM | LOW | P2 |
| Sound effects | LOW | LOW | P3 |
| Physics-based layout | MEDIUM | HIGH | P2 |

**Priority key:**
- P1: Must have for the live talk. Without these, the demo fails.
- P2: Should have. Makes it polished and memorable. Add before the talk if time permits.
- P3: Nice to have. Fun but not essential.

## Competitor Feature Analysis

| Feature | Mentimeter | Slido | Kahoot | Guestbook.tv | This Project |
|---------|-----------|-------|--------|-------------|-------------|
| QR code entry | Yes | Yes | Yes (game PIN) | Yes | Yes -- standard pattern |
| Real-time viz | Word cloud, bar charts | Live poll results | Leaderboard | Photo slideshow | K8s cluster visualization (unique) |
| No-auth participation | Yes | Yes | Yes | Yes | Yes -- frictionless is non-negotiable |
| Content moderation | Manual review queue | Auto-filter + manual | Quiz-only (no UGC risk) | Photo moderation | Constrained input (emoji grid + name filter) |
| Mobile-first form | Yes | Yes | Yes | Yes | Yes |
| Admin controls | Presentation mode | Event admin | Game host | Event owner | Admin panel with toggle + stats |
| Post-event artifact | PDF export | Analytics export | Report | Gallery | Live read-only visualization |
| Theming | Limited | Minimal | Colorful/gamified | Event branding | K8s-native visual language (unique) |
| Animation | Word growth | Results animation | Score reveal | Slideshow transitions | Pod scheduling animation (unique) |
| Scale | Unlimited | Up to 5000 | Up to 2000 | Varies | 100-500 (sufficient for talk) |

**Key insight from competitor analysis:** No existing tool combines audience participation with domain-specific visualization. Mentimeter/Slido/Kahoot are generic. This project's uniqueness is the K8s metaphor -- attendees don't just participate, they become part of a living Kubernetes cluster. That's the story.

## Technical Considerations for Key Features

### Real-time Updates: SSE over WebSockets
- Data flows one direction for the visualization (server to client)
- SSE works over standard HTTP, simpler to implement and deploy behind reverse proxies
- No browser connection limit issues under HTTP/2
- For 500 concurrent viewers, SSE handles this trivially
- The submission form uses standard HTTP POST -- no bidirectional channel needed
- **Confidence:** HIGH (based on Ably, RxDB, and multiple technical comparisons)

### Visualization Rendering: SVG with D3.js
- 500 pods is well within SVG performance limits (threshold is ~1000 before Canvas becomes necessary)
- SVG allows easy CSS animations and hover interactions
- D3.js force simulation handles organic layout within namespace boundaries
- If performance becomes an issue, Canvas is a fallback, but unlikely at this scale
- **Confidence:** HIGH (based on Bocoup, Tapflare, and SVG performance research)

### Reliability: The One Requirement That Cannot Fail
- This runs ONCE during a live talk. There is no retry.
- Pre-load the visualization page before the QR reveal
- Test with simulated 500 concurrent submissions
- Have a pre-recorded fallback video of the visualization in case of catastrophic failure
- Conference WiFi is unreliable -- the submission form must be lightweight (< 100KB)
- **Confidence:** HIGH (based on event technology best practices)

## Sources

- [Mentimeter features and word clouds](https://www.mentimeter.com/features/word-cloud)
- [Slido word cloud and moderation](https://www.slido.com/features-word-cloud)
- [KubeView - K8s cluster visualization](https://kubeview.benco.io/)
- [kube-ops-view - K8s operational dashboard](https://codeberg.org/hjacobs/kube-ops-view)
- [SSE vs WebSockets comparison (Ably)](https://ably.com/blog/websockets-vs-sse)
- [SSE vs WebSockets performance (DEV Community)](https://dev.to/polliog/server-sent-events-beat-websockets-for-95-of-real-time-apps-heres-why-a4l)
- [SVG vs Canvas animation performance (2026)](https://www.augustinfotech.com/blogs/svg-vs-canvas-animation-what-modern-frontends-should-use-in-2026/)
- [Smoothly animate thousands of points with Canvas and D3](https://www.bocoup.com/blog/smoothly-animate-thousands-of-points-with-html5-canvas-and-d3)
- [QR code engagement best practices](https://www.audience.io/blog/qr-code-marketing-strategies-8-ways-to-boost-engagement)
- [Guestbook.tv - real-time event guestbook](https://guestbook.tv/en/)
- [Vevox moderation features](https://www.vevox.com/features/word-cloud)
- [Rate limiting for spam prevention (Cloudflare)](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)
- [Event technology reliability (Blackthorn)](https://blackthorn.io/content-hub/reliable-event-technology-for-success/)

---
*Feature research for: KubeCon Guestbook -- Live audience participation with K8s-style visualization*
*Researched: 2026-03-20*
