---
phase: quick
plan: 260323-kcz
type: execute
wave: 1
depends_on: []
files_modified:
  - server/model.go
  - web/src/components/HomelabScale.tsx
autonomous: true
requirements: [quick-task]
must_haves:
  truths:
    - "Level 3 homelab displays laptop emoji in submission form and visualization"
    - "Level 4 homelab displays money-mouth face emoji in submission form and visualization"
  artifacts:
    - path: "server/model.go"
      provides: "Server-side emoji mapping for levels 3 and 4"
      contains: "\\U0001F4BB"
    - path: "web/src/components/HomelabScale.tsx"
      provides: "Client-side emoji display for levels 3 and 4"
      contains: "\\u{1F4BB}"
  key_links:
    - from: "server/model.go"
      to: "API response homelab_emoji field"
      via: "HomelabEmojis map lookup"
      pattern: "HomelabEmojis"
---

<objective>
Change the homelab level emojis: Level 3 from desktop computer to laptop, Level 4 from file cabinet to money-mouth face.

Purpose: Update the emoji representations to better match the intended homelab level meanings.
Output: Updated emoji mappings in both server (Go) and client (TSX) code.
</objective>

<execution_context>
@/Users/niklas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/niklas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@server/model.go (HomelabEmojis map, lines 29-36)
@web/src/components/HomelabScale.tsx (levels array, lines 1-15)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update emoji mappings in server and client</name>
  <files>server/model.go, web/src/components/HomelabScale.tsx</files>
  <action>
In server/model.go, update the HomelabEmojis map:
- Level 3: Change from "\U0001F5A5\uFE0F" (desktop computer) to "\U0001F4BB" (laptop). Update comment to "laptop computer".
- Level 4: Change from "\U0001F5C4\uFE0F" (file cabinet) to "\U0001F911" (money-mouth face). Update comment to "money-mouth face".

In web/src/components/HomelabScale.tsx, update the levels array:
- Level 3: Change emoji from "\u{1F5A5}\uFE0F" to "\u{1F4BB}" (laptop).
- Level 4: Change emoji from "\u{1F5C4}\uFE0F" to "\u{1F911}" (money-mouth face).

Note: No changes needed in web/src/viz/colors.ts — that file only has text descriptions, not emojis. The HoverCard and PodRow components use the emoji value from the API response (homelab_emoji field), so they will automatically pick up the server-side change.
  </action>
  <verify>
    <automated>cd /Users/niklas/Coding/kubecon-guestbook && grep -c "1F4BB" server/model.go && grep -c "1F911" server/model.go && grep -c "1F4BB" web/src/components/HomelabScale.tsx && grep -c "1F911" web/src/components/HomelabScale.tsx</automated>
  </verify>
  <done>All four grep counts return 1, confirming both emojis are updated in both files. No references to old emojis (1F5A5, 1F5C4) remain in either file.</done>
</task>

</tasks>

<verification>
- grep for old Level 3 emoji (1F5A5) in server/model.go and HomelabScale.tsx returns 0 matches
- grep for old Level 4 emoji (1F5C4) in server/model.go and HomelabScale.tsx returns 0 matches
- grep for new Level 3 emoji (1F4BB) returns 1 match in each file
- grep for new Level 4 emoji (1F911) returns 1 match in each file
- Go code compiles: cd server && go build ./...
</verification>

<success_criteria>
Level 3 homelab shows laptop emoji and Level 4 shows money-mouth face emoji in both the server API response and the client-side submission form.
</success_criteria>

<output>
After completion, create `.planning/quick/260323-kcz-change-homelab-level-emojis-level-3-to-l/260323-kcz-SUMMARY.md`
</output>
