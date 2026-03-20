# Domain Pitfalls

**Domain:** Real-time audience participation app for a live KubeCon conference talk, running on homelab Kubernetes
**Researched:** 2026-03-20

---

## Critical Pitfalls

Mistakes that cause demo failure, data loss, or a broken live moment on stage. There are no second chances with a conference demo.

---

### Pitfall 1: The Thundering Herd -- 500 Users Hit Submit Simultaneously

**What goes wrong:** Niklas shows the QR code, and within 30-60 seconds, 300-500 attendees all scan it and submit the form. This is a textbook thundering herd: a synchronized burst of connections and writes that overwhelms the backend before any autoscaling can react. The homelab server crashes or becomes unresponsive during the most important 60 seconds of the talk.

**Why it happens:** Unlike normal web traffic that grows gradually, a conference QR code moment creates a near-instantaneous spike. Every attendee acts at the same time. The homelab hardware has finite CPU and memory. Database write contention compounds the issue -- every submission is a write, and 500 concurrent writes to a small database can exhaust connection pools.

**Consequences:** The app goes down during the live demo. Attendees see error screens. The visualization never populates. The talk's climactic moment falls flat.

**Prevention:**
- Load test with simulated burst traffic of 500+ concurrent connections BEFORE the talk. Use tools like `k6` or `artillery` to simulate the exact burst pattern.
- Use an in-memory store (Redis or even an in-memory array) as a write buffer, not direct database writes. Queue submissions and flush to persistent storage asynchronously.
- Pre-warm the application pods. Do not rely on cold starts or HPA scaling during the demo.
- Set resource requests/limits generously for the demo window. Over-provision the homelab node for this event.
- Keep the submission endpoint as lightweight as possible: validate, queue, respond 200. No heavy processing in the request path.

**Detection:** Run a load test that simulates 500 users connecting and submitting within 10 seconds. If response times exceed 2 seconds or error rates exceed 0%, the app is not ready.

**Phase relevance:** Must be addressed in backend development and validated with a dedicated load testing phase before the talk.

**Confidence:** HIGH -- thundering herd is a well-documented pattern and this use case is a textbook trigger.

---

### Pitfall 2: Conference WiFi Kills the Demo

**What goes wrong:** Conference venue WiFi cannot handle 500 devices simultaneously connecting to the same external URL. The network buckles under the density -- connections time out, the QR code page never loads, or real-time connections drop immediately.

**Why it happens:** A corporate conference with 500 attendees can generate 1,000-1,500 simultaneous device connections during peak usage. Most venue WiFi degrades above 50-75 active connections per access point. Even KubeCon's WiFi, while better than average, serves thousands of attendees across the venue. Steve Jobs' famous iPhone 4 demo failed because the keynote WiFi was overloaded -- and that was Apple's own event.

**Consequences:** Attendees cannot reach the app. The guestbook stays empty. The visualization screen shows nothing.

**Prevention:**
- The app is hosted on Niklas's homelab, accessed over the public internet. Attendees use mobile data (4G/5G) as a fallback when WiFi is congested. Make the submission form ultra-lightweight (< 50KB total page weight) so it loads fast even on slow connections.
- Provide BOTH a QR code and a short memorable URL (e.g., `kubecon.niklas.dev`). Some phones have QR scanning issues; a typeable URL is a critical fallback.
- The submission form should work entirely with a single HTTP POST. Do not require a persistent real-time connection for the attendee's phone -- only the presenter's visualization screen needs a live connection.
- Consider making the form a static page with minimal JS that submits via a simple fetch POST. Progressive enhancement, not SPA bloat.
- Test the app from a phone on a throttled connection (3G simulation) to verify it works under poor network conditions.

**Detection:** Test the form on a 3G-throttled connection. If it takes more than 3 seconds to load and submit, optimize further. Test the QR code on at least 3 different phone models (iOS Safari, Android Chrome, Samsung Internet).

**Phase relevance:** Architecture phase (keep submission form minimal) and testing phase (network simulation).

**Confidence:** HIGH -- conference WiFi problems are extensively documented. Apple, Meta, and countless others have had live demos fail from WiFi issues.

---

### Pitfall 3: Choosing the Wrong Real-Time Transport

**What goes wrong:** Using WebSockets where Server-Sent Events (SSE) suffice, or using SSE without understanding its proxy buffering limitations. Either choice, made without understanding the tradeoffs, leads to dropped connections, missing updates, or unnecessary complexity.

**Why it happens:** This app has an asymmetric communication pattern: attendees SEND data (form submissions), and the visualization screen RECEIVES data (real-time pod appearances). Developers default to WebSockets for anything "real-time," but WebSockets add complexity (upgrade handshake, stateful connections, reconnection logic) that is unnecessary when you only need server-to-client push.

However, SSE has a documented production pitfall: intermediate network proxies can buffer SSE streams and never deliver events until the connection closes. This is legal per the HTTP spec and cannot be prevented by headers.

**Consequences:** With over-engineered WebSockets: more complex code, harder debugging, unnecessary bidirectional channel. With naive SSE: events silently buffered by proxies, visualization never updates.

**Prevention:**
- Use SSE for the visualization screen's real-time feed. The visualization screen is the presenter's laptop on a controlled network (connected to the homelab or with a known network path). Proxy buffering is unlikely on a controlled path.
- Use plain HTTP POST for attendee submissions. No real-time connection needed on attendee phones at all.
- Implement SSE with keep-alive comments (`: keep-alive\n\n` every 15 seconds) to prevent proxy timeouts and detect dead connections.
- Include `Last-Event-ID` support so the visualization can recover missed events on reconnect.
- Have a fallback: if SSE fails, the visualization should poll `/api/entries` every 2 seconds. This is ugly but functional -- better than a blank screen.

**Detection:** Test the SSE connection through the full network path (homelab -> internet -> venue network -> presenter laptop). If events are delayed by more than 1 second, investigate proxy buffering.

**Phase relevance:** Architecture decision -- must be settled before backend development begins.

**Confidence:** HIGH -- SSE vs WebSocket tradeoffs are well-documented. The proxy buffering issue is a verified production concern, but mitigated in this case by the controlled visualization network path.

---

### Pitfall 4: Visualization Screen Crashes Under Load

**What goes wrong:** The browser tab rendering the Kubernetes cluster visualization slows to a crawl, freezes, or crashes when 500 animated pod elements are on screen. The "wow moment" becomes a stuttering mess.

**Why it happens:** SVG performance degrades exponentially with element count. Each SVG node is a DOM element that the browser must composite, style, and layout. At 500 animated elements with CSS transitions, the browser's 16.7ms frame budget (60fps) is blown. Memory also accumulates if DOM nodes from pod animations are not properly cleaned up, causing memory leaks in the long-running visualization tab.

**Consequences:** The visualization jitters, stutters, or freezes on the big screen in front of the entire audience.

**Prevention:**
- Use HTML5 Canvas (via a library like Konva or PixiJS) instead of SVG for rendering pods. Canvas is a bitmap buffer with no DOM overhead per element -- performance remains constant regardless of element count. React + Canvas via Konva handles 4,000+ elements smoothly.
- If using SVG for simplicity, limit animations to CSS `transform` and `opacity` only (GPU-accelerated properties). Never animate `width`, `height`, `top`, `left`, or other layout-triggering properties.
- Implement object pooling: reuse DOM/canvas elements instead of creating and destroying them.
- Set a reasonable animation budget: new pods animate in over 500ms, then become static. Do not continuously animate all 500 pods.
- Profile the visualization with Chrome DevTools Performance tab at 500 elements before the talk. Target: no frames exceeding 16ms.

**Detection:** Open the visualization, add 500 test entries programmatically, and watch the FPS counter in Chrome DevTools. If it drops below 30fps, the rendering approach must change.

**Phase relevance:** Frontend visualization phase. This is a make-or-break decision for Canvas vs SVG.

**Confidence:** HIGH -- SVG vs Canvas performance at scale is extensively benchmarked. SVG degrades at 500+ animated elements; Canvas does not.

---

### Pitfall 5: Mobile Browser QR Code Scanning Fragmentation

**What goes wrong:** Attendees scan the QR code but end up in an in-app browser (Instagram, LinkedIn, iOS Code Scanner) that cannot properly load the app, has restricted functionality, or loses the page when the user switches apps.

**Why it happens:** iOS Code Scanner (from Control Centre) opens URLs in a modal in-app browser that is lost if the user switches apps. Social media in-app browsers have restricted APIs. Some older Android phones cannot scan QR codes natively. Different phones have different default behaviors when scanning QR codes.

**Consequences:** 10-30% of attendees cannot access the form, reducing the visual impact of the guestbook filling up.

**Prevention:**
- Display a SHORT, memorable URL alongside the QR code (e.g., `kubecon.niklas.dev`). This is not optional -- it is the critical fallback for every QR failure mode.
- Ensure the form page is a vanilla, lightweight HTML page that works in ANY browser context -- including in-app browsers and webviews. No reliance on APIs that webviews restrict.
- Test the QR code flow on: iOS Camera app, iOS Code Scanner, Android Camera, Google Lens, Samsung Internet, and at least one in-app browser (LinkedIn/Twitter).
- Use a high-contrast, large QR code on the slide. Low contrast or small QR codes fail to scan from audience distance. Minimum size: 15-20% of slide width.
- The QR code should point to a HTTPS URL (required for modern mobile browsers to function properly).

**Detection:** Test with 5+ different devices before the talk. If any device cannot complete the flow from scan to submission in under 15 seconds, fix the bottleneck.

**Phase relevance:** Design phase (URL strategy, QR code design) and testing phase (device matrix testing).

**Confidence:** HIGH -- QR code scanning fragmentation across iOS/Android is extensively documented.

---

## Moderate Pitfalls

---

### Pitfall 6: Kubernetes Ingress Kills WebSocket/SSE Connections After 60 Seconds

**What goes wrong:** The NGINX Ingress Controller has a default `proxy-read-timeout` of 60 seconds. If no data flows within 60 seconds, the connection is terminated. The visualization screen's real-time connection drops every minute, causing gaps in pod appearances.

**Prevention:**
- Set ingress annotations for extended timeouts:
  ```yaml
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-buffering: "off"
  ```
- Send SSE keep-alive comments every 15-30 seconds to reset proxy timers.
- Implement client-side reconnection with `Last-Event-ID` for seamless recovery.

**Detection:** Leave the visualization running for 5 minutes without any submissions. If the SSE connection drops, the ingress timeout configuration is wrong.

**Phase relevance:** Infrastructure/deployment phase. This is a one-time configuration but easy to miss.

**Confidence:** HIGH -- this is documented in multiple Kubernetes ingress-nginx GitHub issues (#5167, #14112).

---

### Pitfall 7: Mobile Phones Kill Background Connections

**What goes wrong:** Attendees submit the form, then lock their phone or switch to another app. If the app has any dependency on a persistent connection from attendee phones (e.g., to show a "you're in!" confirmation that updates), that connection dies. iOS Safari drops WebSocket connections aggressively when the tab goes to background. Android Chrome suspends timers, causing heartbeat timeouts.

**Prevention:**
- Design the attendee flow to be fire-and-forget: submit the form, see a static "thanks!" confirmation page. No persistent connection needed from the attendee's phone.
- Only the visualization screen (presenter's laptop, always in foreground) maintains a real-time connection.
- If the attendee does need updates, use polling on visibility change (`document.addEventListener('visibilitychange', ...)`) rather than a persistent connection.

**Detection:** Submit from a phone, lock the screen for 30 seconds, unlock, and verify the thank-you page still displays correctly.

**Phase relevance:** Architecture decision -- keep attendee phones stateless and connectionless.

**Confidence:** HIGH -- iOS Safari and Android Chrome background tab behavior is extensively documented in GitHub issues.

---

### Pitfall 8: No Content Moderation = Offensive Content on the Big Screen

**What goes wrong:** Without authentication, anyone with the URL can submit anything. An attendee (or malicious remote user) submits an offensive name that appears as a pod label on the big screen in front of a KubeCon audience.

**Why it happens:** The form is intentionally unauthenticated for frictionless access. Free-text name fields accept anything. The app is publicly accessible, so even non-attendees could find and abuse it.

**Prevention:**
- Use an emoji selector (already planned) instead of free-text for the homelab emoji -- this eliminates one attack vector entirely.
- Implement a server-side profanity filter on the name field. Use a library like `bad-words` or `leo-profanity`. This catches obvious cases.
- Add an admin moderation queue: submissions appear in the admin panel first, with a configurable toggle between "auto-approve" (for speed during the talk) and "manual approve" (for safety).
- Rate limit submissions: 1 submission per IP address. This prevents flooding.
- Add a honeypot field to the form to catch basic bots.
- Keep the admin panel open during the talk so Niklas (or a helper) can quickly delete offensive entries if they slip through.

**Detection:** Test the profanity filter with a list of known offensive terms. Verify the admin can delete an entry and it disappears from the visualization within 2 seconds.

**Phase relevance:** Backend development phase (profanity filter, rate limiting) and admin panel phase.

**Confidence:** HIGH -- content moderation for user-generated content at live events is a well-understood problem.

---

### Pitfall 9: Homelab Goes Down and Nobody Notices Until the Talk

**What goes wrong:** The homelab Kubernetes cluster experiences a failure hours or days before the talk -- a node reboot, power outage, disk failure, certificate expiry, or DNS issue. Niklas arrives at KubeCon and discovers the app is unreachable.

**Prevention:**
- Set up external uptime monitoring (UptimeRobot, Healthchecks.io, or similar) that pings the app's health endpoint every minute and sends alerts via SMS/push notification.
- Deploy a `/healthz` endpoint that verifies database connectivity and SSE functionality, not just "server is running."
- Ensure TLS certificates are valid and will not expire before/during the conference. Use cert-manager with Let's Encrypt and verify certificate expiry dates.
- Run the app for at least 7 days continuously before the talk to catch stability issues (memory leaks, connection exhaustion, certificate rotation failures).
- Have a backup plan: a pre-recorded video of the visualization working, or a static version of the guestbook hosted on a cloud provider as a fallback.

**Detection:** Monitoring alerts fire if the app is unreachable for more than 2 minutes.

**Phase relevance:** Infrastructure/deployment phase and pre-talk operations checklist.

**Confidence:** HIGH -- homelab reliability is inherently lower than cloud hosting. DNS, TLS, and power are the top failure modes.

---

### Pitfall 10: Single Replica Deployment = Zero Fault Tolerance

**What goes wrong:** Running a single pod replica means any pod restart (OOM kill, node maintenance, rolling update) causes complete downtime. During a rolling update, Kubernetes terminates the old pod before the new one is ready (or there is a gap), dropping all active connections.

**Prevention:**
- Run at least 2 replicas of the backend during the talk, with a `maxUnavailable: 0` rolling update strategy so at least one pod is always serving.
- If running 2 replicas with SSE, use a pub/sub mechanism (Redis pub/sub) so both replicas broadcast events. A load balancer may send the visualization to either replica.
- Configure readiness probes so traffic is only routed to pods that are fully initialized.
- Set `terminationGracePeriodSeconds` to allow in-flight connections to complete.
- Alternatively, if the homelab cannot support 2 replicas: freeze deployments before the talk. Do NOT deploy anything within 24 hours of going on stage.

**Detection:** Simulate a pod kill (`kubectl delete pod`) while the visualization is running. If the visualization goes blank for more than 3 seconds, the deployment strategy needs work.

**Phase relevance:** Infrastructure/deployment phase.

**Confidence:** HIGH -- single-replica limitations in Kubernetes are well-documented.

---

## Minor Pitfalls

---

### Pitfall 11: Location Field Produces Too Many or Too Few Namespaces

**What goes wrong:** If the location field is free-text, attendees enter variations like "London", "london", "London, UK", "UK", "England" -- creating dozens of tiny namespace clusters that make the visualization messy and unreadable. Alternatively, if locations are too coarse (just countries), everyone clusters into 3-4 giant namespaces with no visual variety.

**Prevention:**
- Use a predefined dropdown of 15-30 locations/regions rather than free-text. Include the most likely attendee origins for a KubeCon EU event (e.g., Germany, UK, Netherlands, France, USA, India, etc.).
- Alternatively, use free-text but normalize on the backend: group by country, apply fuzzy matching, or use a simple mapping table.
- Test the visualization with realistic distributions: 40% local country, 30% rest of Europe, 20% Americas, 10% Asia/other.

**Detection:** Look at the visualization with 20+ test entries from varied locations. If there are more than 15 namespace clusters or fewer than 4, adjust the grouping strategy.

**Phase relevance:** Design phase (form fields) and backend phase (normalization logic).

**Confidence:** MEDIUM -- depends on the specific form design chosen.

---

### Pitfall 12: Visualization Layout Does Not Scale to the Big Screen

**What goes wrong:** The visualization looks fine on a laptop screen but breaks on a conference projector: text is unreadable, pods are too small, colors wash out under bright stage lighting, or the layout does not fill the 16:9 projected screen.

**Prevention:**
- Design the visualization for 1920x1080 (Full HD projector resolution) from the start.
- Use high-contrast colors (avoid light grays, pale colors that wash out under stage lighting). Dark background with bright pods works best on projectors.
- Test on an external monitor or TV at the exact resolution the projector will use.
- Make pod labels large enough to read from 10+ meters away.
- Use the full screen width -- a visualization that clusters in the center wastes 50% of the visual impact.

**Detection:** Display the visualization on a TV from across the room. If text is unreadable or pods are indistinguishable, increase sizes and contrast.

**Phase relevance:** Frontend visualization phase.

**Confidence:** MEDIUM -- standard presentation design advice, but easily overlooked by developers focused on "does it work on my laptop."

---

### Pitfall 13: Forgetting the "After the Talk" Read-Only Mode

**What goes wrong:** After the talk, the guestbook stays writable and accumulates spam, or it silently breaks because the homelab was reconfigured, and nobody notices for months.

**Prevention:**
- Implement the admin "close submissions" toggle that switches the form to a read-only "view the guestbook" mode with a clear message.
- Export the guestbook data (JSON dump or database backup) immediately after the talk as a permanent artifact, independent of homelab uptime.
- Consider generating a static HTML snapshot of the visualization that can be hosted anywhere (GitHub Pages, Netlify) as a permanent record.

**Detection:** Toggle the admin "close submissions" switch and verify the form becomes read-only and the visualization remains viewable.

**Phase relevance:** Admin panel phase and post-talk operations.

**Confidence:** HIGH -- the project requirements explicitly call for this, but it is easily deprioritized.

---

### Pitfall 14: DNS and TLS Certificate Issues Under Pressure

**What goes wrong:** The custom domain's DNS does not resolve from the conference venue's network, or the TLS certificate has expired or is not trusted on certain mobile browsers. Attendees see browser security warnings and abandon the page.

**Prevention:**
- Use a well-known DNS provider (Cloudflare) with low TTLs. Verify DNS resolution from multiple locations (use `dig` from different networks, or online tools like dnschecker.org).
- Use Let's Encrypt with cert-manager for automatic certificate renewal. Verify the cert is valid for at least 30 days beyond the talk date.
- Test HTTPS access from a phone on mobile data (not the homelab network) to catch NAT hairpinning issues where the domain resolves correctly externally but not internally.
- Have the raw IP address + port as an absolute last resort fallback (not pretty, but functional).

**Detection:** Run `curl -I https://kubecon.niklas.dev` from an external network 24 hours before the talk. Any non-200 response is a red flag.

**Phase relevance:** Infrastructure/deployment phase.

**Confidence:** HIGH -- DNS and TLS are the most common causes of "it works on my machine but not from here."

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Architecture | Over-engineering with WebSockets for attendee phones | Use HTTP POST for submissions, SSE only for the visualization screen |
| Architecture | Tight coupling between submission and visualization | Decouple with an event queue or pub/sub; submissions should succeed even if visualization is down |
| Backend Development | Database write contention under burst load | Buffer writes in memory, flush to DB asynchronously |
| Backend Development | No rate limiting on open form | 1 submission per IP, honeypot field, profanity filter |
| Frontend Visualization | SVG performance cliff at 500 elements | Use Canvas (Konva/PixiJS) from the start, not SVG |
| Frontend Visualization | Animations triggering layout reflows | Only animate `transform` and `opacity`; use `requestAnimationFrame` |
| Frontend Form | Form too heavy for conference WiFi | Target < 50KB total page weight, no SPA framework on the submission page |
| Frontend Form | In-app browser compatibility | Test in iOS Code Scanner, Android webviews, LinkedIn/Twitter in-app browsers |
| Infrastructure | NGINX ingress default 60s timeout kills SSE | Set `proxy-read-timeout: 3600`, `proxy-buffering: off` |
| Infrastructure | Single replica = single point of failure | Run 2 replicas with Redis pub/sub, or freeze deploys before the talk |
| Infrastructure | TLS cert expires before/during conference | cert-manager + verify expiry > 30 days beyond talk date |
| Testing | Not load testing the burst pattern | Simulate 500 concurrent connections with k6 or artillery |
| Testing | Only testing on fast WiFi | Throttle to 3G and test form submission flow end-to-end |
| Pre-Talk Operations | Homelab down without alerting | External uptime monitor (UptimeRobot) + SMS alerts |
| Pre-Talk Operations | No backup plan for total failure | Pre-recorded video of visualization, static fallback page |

---

## The One-Chance Rule

This app has a unique constraint that makes every pitfall more severe: **there is exactly one chance to get it right.** A regular web app can be fixed and redeployed after a bug is found. This app has a 60-second window during a live talk where it either works or it does not. Every pitfall above should be evaluated through this lens:

- If it can fail during the live demo, it must be tested and proven beforehand.
- If it cannot be tested in advance (e.g., conference WiFi), there must be a fallback.
- If there is no fallback, over-engineer the resilience.

---

## Sources

- [Ably: The Challenge of Scaling WebSockets](https://ably.com/topic/the-challenge-of-scaling-websockets)
- [WebSocket.org: Kubernetes WebSocket Ingress](https://websocket.org/guides/infrastructure/kubernetes/)
- [kubernetes/ingress-nginx Issue #5167: WebSocket closing after 60s](https://github.com/kubernetes/ingress-nginx/issues/5167)
- [kubernetes/ingress-nginx Issue #14112: WebSocket closes after 5 minutes](https://github.com/kubernetes/ingress-nginx/issues/14112)
- [DEV.to: SSE still not production ready - proxy buffering issue](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie)
- [Ably: WebSockets vs SSE](https://ably.com/blog/websockets-vs-sse)
- [Nimbleway: SSE vs WebSockets 2026 Guide](https://www.nimbleway.com/blog/server-sent-events-vs-websockets-what-is-the-difference-2026-guide)
- [Swizec: Smooth animation up to 4,000 elements with React and Canvas](https://swizec.com/blog/livecoding-14-mostlysmooth-animation-up-to-4000-elements-with-react-and-canvas/)
- [August InfoTech: SVG vs Canvas Animation 2026](https://www.augustinfotech.com/blogs/svg-vs-canvas-animation-what-modern-frontends-should-use-in-2026/)
- [Boris Smus: Canvas vs SVG Performance](https://smus.com/canvas-vs-svg-performance/)
- [Medium: How to avoid wireless connection problems at events](https://medium.com/talking-event-tech/how-to-avoid-wireless-connection-problems-at-your-next-event-667191aa46bc)
- [Joel on Software: The WiFi at Conferences Problem](https://www.joelonsoftware.com/2009/10/08/the-wifi-at-conferences-problem/)
- [Uniqode: 9 Reasons QR Codes Fail](https://www.uniqode.com/blog/qr-code-best-practices/qr-code-not-working)
- [Niels Leenheer: Complete and Utter Demo Failure](https://nielsleenheer.com/articles/2017/complete-and-utter-demo-failure/)
- [Qovery: 11 Essential Configurations for Zero-Downtime K8s](https://www.qovery.com/blog/how-to-achieve-zero-downtime-application-with-kubernetes)
- [Medium: Thundering Herd Problem (2026)](https://medium.com/@swagatika07/thundering-herd-problem-fc7042e874c6)
- [Scalable Thread: How to Handle Sudden Bursts of Traffic](https://newsletter.scalablethread.com/p/how-to-handle-sudden-bursts-of-traffic)
- [MDN: Animation Performance and Frame Rate](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)
- [GitHub graphql-ws #290: Safari drops WebSocket on screen lock](https://github.com/enisdenjo/graphql-ws/discussions/290)
- [supabase/realtime-js #121: WebSocket loses connection in background tab](https://github.com/supabase/realtime-js/issues/121)
