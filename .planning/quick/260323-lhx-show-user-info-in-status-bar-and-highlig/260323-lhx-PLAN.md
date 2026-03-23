---
phase: quick-260323-lhx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/viz/StatsOverlay.tsx
  - web/src/viz/renderer.ts
  - web/src/viz/VizPage.tsx
  - web/src/style.css
autonomous: true
requirements: [QUICK-LHX]

must_haves:
  truths:
    - "User who submitted sees their name, country flag, and homelab emoji in the status bar"
    - "User who did NOT submit (e.g. submissions closed, direct /viz visitor) sees no user info in the status bar"
    - "User's own pod has a persistent glow effect distinguishing it from all other pods"
    - "Glow effect is local-only, based on localStorage — other users do not see it"
  artifacts:
    - path: "web/src/viz/StatsOverlay.tsx"
      provides: "Status bar with optional user info section"
    - path: "web/src/viz/renderer.ts"
      provides: "Persistent glow for the user's own pod"
    - path: "web/src/viz/VizPage.tsx"
      provides: "Exports currentUserId signal read from localStorage"
    - path: "web/src/style.css"
      provides: "CSS for user info section in stats overlay"
  key_links:
    - from: "web/src/viz/VizPage.tsx"
      to: "localStorage guestbook_submission"
      via: "JSON.parse to extract id"
      pattern: "localStorage\\.getItem.*guestbook_submission"
    - from: "web/src/viz/StatsOverlay.tsx"
      to: "web/src/viz/VizPage.tsx"
      via: "imports currentUserInfo signal"
      pattern: "currentUserInfo"
    - from: "web/src/viz/renderer.ts"
      to: "web/src/viz/VizPage.tsx"
      via: "imports currentUserId signal for glow check"
      pattern: "currentUserId"
---

<objective>
Show the current user's info (name, country flag, homelab emoji) in the visualization status bar and highlight their pod with a persistent glow effect, so users can easily identify themselves in the crowd after submitting.

Purpose: When a user submits the form and lands on the visualization, they should immediately know which pod is theirs and see their info confirmed in the status bar.
Output: Updated StatsOverlay with user info, persistent glow on user's pod in the canvas renderer.
</objective>

<execution_context>
@/Users/niklas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/niklas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@web/src/viz/VizPage.tsx
@web/src/viz/StatsOverlay.tsx
@web/src/viz/renderer.ts
@web/src/viz/types.ts
@web/src/viz/colors.ts
@web/src/app.tsx
@web/src/style.css

<interfaces>
<!-- Key types and contracts the executor needs. -->

From web/src/api.ts:
```typescript
export interface SubmitResponse {
  id: number;
  name: string;
  country_code: string;
  country_flag: string;
  homelab_level: number;
  homelab_emoji: string;
  created_at: string;
}
```

From web/src/viz/types.ts:
```typescript
export interface PodNode extends SimulationNodeDatum {
  id: number;
  name: string;
  countryCode: string;
  countryFlag: string;
  homelabLevel: number;
  homelabEmoji: string;
  clusterId: string;
  animProgress: number;
  animStartTime: number;
  glowOpacity: number;
}
```

From web/src/viz/colors.ts:
```typescript
export const LEVEL_COLORS: Record<number, string> = { 1: '#60a5fa', 2: '#fb7185', 3: '#fbbf24', 4: '#2dd4bf', 5: '#a78bfa' };
```

localStorage key: `guestbook_submission` stores JSON of SubmitResponse.
The existing glow mechanism uses `node.glowOpacity` (0..1) and draws via `ctx.shadowColor + ctx.shadowBlur` in `drawPod()`.
StatsOverlay reads `podCount` and `nsCount` signals from VizPage.tsx.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add user info to status bar and expose current user signals</name>
  <files>web/src/viz/VizPage.tsx, web/src/viz/StatsOverlay.tsx, web/src/style.css</files>
  <action>
1. In `web/src/viz/VizPage.tsx`, add two new exported signals at module level (near the existing `podCount`/`nsCount` signals):
   - `currentUserId` of type `signal<number | null>` — the submission ID of the current user, or null if not submitted.
   - `currentUserInfo` of type `signal<{ name: string; countryFlag: string; homelabEmoji: string } | null>` — user display info, or null.

   Initialize both by reading localStorage at module load time:
   ```typescript
   const storedSubmission = localStorage.getItem('guestbook_submission');
   const parsedSubmission = storedSubmission ? JSON.parse(storedSubmission) as SubmitResponse : null;
   export const currentUserId = signal<number | null>(parsedSubmission?.id ?? null);
   export const currentUserInfo = signal<{ name: string; countryFlag: string; homelabEmoji: string } | null>(
     parsedSubmission ? { name: parsedSubmission.name, countryFlag: parsedSubmission.country_flag, homelabEmoji: parsedSubmission.homelab_emoji } : null
   );
   ```
   Import `SubmitResponse` type from `'../api'` (already imported in VizPage.tsx as `import type { SubmitResponse } from '../api';`).

2. In `web/src/viz/StatsOverlay.tsx`, import `currentUserInfo` from `'./VizPage'` alongside the existing `podCount`/`nsCount` imports. Add a user info section that renders only when `currentUserInfo.value` is non-null:
   - After the existing stats content (pods/namespaces), add a separator and user info.
   - Layout: The stats overlay becomes two lines when user info is present. First line: existing "N pods . N namespaces". Second line: "{homelabEmoji} {name} {countryFlag}" styled slightly smaller and in secondary color.
   - Use a `<div class="stats-user">` wrapper that only renders if `currentUserInfo.value` is not null.
   - The user line format: `{homelabEmoji} {name} {countryFlag}` — showing the emoji, their name, and their country flag.

3. In `web/src/style.css`, add styles for the user info section inside `.stats-overlay`:
   ```css
   .stats-user {
     display: flex;
     align-items: center;
     gap: 6px;
     margin-top: 4px;
     padding-top: 4px;
     border-top: 1px solid var(--color-border);
     font-size: 13px;
     font-weight: 500;
     color: var(--color-text-secondary);
   }
   ```
   Also update `.stats-overlay` to add `flex-direction: column;` so it stacks the two rows vertically. The existing stats line should be wrapped in a div to keep it as a horizontal flex row. Update the component structure accordingly:
   - `.stats-overlay` gets `flex-direction: column` added.
   - Wrap the existing pods/namespaces stats in `<div class="stats-main">` with `display: flex; align-items: center;`.

   Add:
   ```css
   .stats-main {
     display: flex;
     align-items: center;
   }
   ```
  </action>
  <verify>
    <automated>cd /Users/niklas/Coding/kubecon-guestbook/web && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Status bar shows user info (emoji, name, flag) on a second line below the pod/namespace counts when the user has a localStorage submission. When no submission exists, the status bar looks identical to before (single line of stats only). TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add persistent glow to user's own pod in canvas renderer</name>
  <files>web/src/viz/renderer.ts</files>
  <action>
1. In `web/src/viz/renderer.ts`, import `currentUserId` from `'./VizPage'`.

2. Modify the `drawPod()` function to add a persistent glow for the user's own pod. Currently the glow is temporary (fades via `node.glowOpacity`). For the user's pod, add an ADDITIONAL persistent glow that does NOT fade:
   - After the existing glow block (`if (node.glowOpacity > 0)`), add a check: `if (currentUserId.value !== null && node.id === currentUserId.value)`.
   - When this is the user's pod, apply a persistent outer glow using `ctx.shadowColor` and `ctx.shadowBlur`. Use the pod's level color (already computed as `color`) with `shadowBlur` of 20 and full opacity. This creates a soft, always-visible halo around the user's pod.
   - The persistent glow should REPLACE the temporary entrance glow once the entrance animation is done — i.e., the logic should be: if it's the user's pod, always apply shadowBlur 20 with the level color, regardless of `glowOpacity`. If it's NOT the user's pod, use the existing temporary glow logic.

   Updated glow logic in `drawPod()`:
   ```typescript
   // Glow effect
   const isCurrentUser = currentUserId.value !== null && node.id === currentUserId.value;
   if (isCurrentUser) {
     // Persistent glow for the user's own pod
     ctx.shadowColor = color;
     ctx.shadowBlur = 20;
   } else if (node.glowOpacity > 0) {
     // Temporary entrance glow for other pods
     ctx.shadowColor = color;
     ctx.shadowBlur = 15 * node.glowOpacity;
   }
   ```

3. To ensure the user's pod draws ON TOP of other pods (making it more visible), modify the sort in `drawFrame()`. Currently pods are sorted by `animProgress` (ascending, so newer pods draw on top). Add a secondary sort: if the node is the current user's pod, draw it last (on top of everything). Change the sort in step 6 of `drawFrame()`:
   ```typescript
   visibleNodes.sort((a, b) => {
     const aIsUser = currentUserId.value !== null && a.id === currentUserId.value ? 1 : 0;
     const bIsUser = currentUserId.value !== null && b.id === currentUserId.value ? 1 : 0;
     if (aIsUser !== bIsUser) return aIsUser - bIsUser; // user's pod draws last (on top)
     return a.animProgress - b.animProgress;
   });
   ```

4. Do NOT modify PodNode types or simulation logic. The glow is purely a rendering concern driven by the `currentUserId` signal.
  </action>
  <verify>
    <automated>cd /Users/niklas/Coding/kubecon-guestbook/web && npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>The user's own pod has a persistent glow halo (shadowBlur 20, level color) that never fades, making it always distinguishable from other pods. The user's pod renders on top of others. Other pods retain the normal temporary entrance glow behavior. Build succeeds with no errors.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd web && npx tsc --noEmit` — no errors
2. Build succeeds: `cd web && npm run build` — produces dist output
3. Manual verification steps:
   - Clear localStorage, visit `/viz` — status bar should show ONLY "N pods . N namespaces" (no user info line)
   - Submit the form (or set `localStorage.setItem('guestbook_submission', JSON.stringify({id:1,name:"Test",country_code:"DE",country_flag:"\ud83c\udde9\ud83c\uddea",homelab_level:3,homelab_emoji:"\ud83d\udcbb",created_at:"2026-01-01"}))`) and visit `/viz` — status bar should show two lines: stats on top, user info below
   - User's pod should have a persistent glow that never fades (other pods' glow fades after 2 seconds)
</verification>

<success_criteria>
- Status bar conditionally shows user info (emoji + name + flag) when localStorage has a submission
- Status bar shows only pod/namespace counts when no submission exists
- User's own pod has a persistent glow halo on the canvas that does not fade
- User's pod renders on top of other pods
- TypeScript compiles cleanly and build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/260323-lhx-show-user-info-in-status-bar-and-highlig/260323-lhx-SUMMARY.md`
</output>
