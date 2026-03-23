---
phase: quick
plan: 260323-krb
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [quick-task]

must_haves:
  truths:
    - "Entry form HomelabScale shows laptop emoji (U+1F4BB) for level 3"
    - "Entry form HomelabScale shows money-mouth face emoji (U+1F911) for level 4"
    - "No old emojis (desktop computer U+1F5A5, file cabinet U+1F5C4) remain in source code"
  artifacts: []
  key_links: []
---

<objective>
Verify and confirm that homelab level emojis on the entry form are already updated to laptop (level 3) and money-mouth face (level 4).

Purpose: The previous quick task 260323-kcz updated emojis in `server/model.go` and `web/src/components/HomelabScale.tsx`. The entry form (`SubmissionForm.tsx`) renders `HomelabScale` directly, so it should already display the correct emojis. This plan verifies correctness and, if any discrepancy is found, fixes it.

Output: Confirmed correct emojis in entry form, or fix applied if needed
</objective>

<execution_context>
@/Users/niklas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/niklas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@web/src/components/HomelabScale.tsx
@web/src/components/SubmissionForm.tsx
@server/model.go
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify entry form emoji correctness and rebuild frontend</name>
  <files>web/src/components/HomelabScale.tsx</files>
  <action>
1. Verify that `web/src/components/HomelabScale.tsx` contains the correct emojis:
   - Level 3: `"\u{1F4BB}"` (laptop computer) with label "The spare laptop era"
   - Level 4: `"\u{1F911}"` (money-mouth face) with label "My partner asks about the electricity bill"

2. Verify that NO old emojis remain in the codebase source files:
   - grep for `1F5A5` (old desktop computer) in `server/model.go` and `web/src/components/HomelabScale.tsx` — should return 0 matches
   - grep for `1F5C4` (old file cabinet) in `server/model.go` and `web/src/components/HomelabScale.tsx` — should return 0 matches

3. Rebuild the frontend to ensure the dist bundle reflects current source:
   - Run `cd web && npm run build` to regenerate `web/dist/`
   - Verify the built JS bundle contains the correct emoji characters (laptop and money-mouth face, not desktop computer or file cabinet)

4. If verification in step 1 or 2 FAILS (old emojis found), update `HomelabScale.tsx`:
   - Level 3 emoji: change to `"\u{1F4BB}"` (laptop)
   - Level 4 emoji: change to `"\u{1F911}"` (money-mouth face)
   Then rebuild again.

Note: The entry form uses `HomelabScale` component directly (imported in `SubmissionForm.tsx` line 6, rendered at line 128). There is no separate emoji definition for the entry form — the `HomelabScale.tsx` levels array is the single source of truth for the form's emoji display.
  </action>
  <verify>
    <automated>cd /Users/niklas/Coding/kubecon-guestbook && grep -c "1F4BB" web/src/components/HomelabScale.tsx && grep -c "1F911" web/src/components/HomelabScale.tsx && test $(grep -c "1F5A5" web/src/components/HomelabScale.tsx) -eq 0 && test $(grep -c "1F5C4" web/src/components/HomelabScale.tsx) -eq 0 && echo "PASS: Entry form emojis are correct"</automated>
  </verify>
  <done>HomelabScale.tsx contains laptop emoji (U+1F4BB) for level 3 and money-mouth face (U+1F911) for level 4. No old emojis remain. Frontend bundle rebuilt with correct emojis.</done>
</task>

</tasks>

<verification>
- `web/src/components/HomelabScale.tsx` level 3 emoji is `\u{1F4BB}` (laptop)
- `web/src/components/HomelabScale.tsx` level 4 emoji is `\u{1F911}` (money-mouth face)
- No references to old emojis (`1F5A5` desktop or `1F5C4` file cabinet) in source files
- `web/dist/` rebuilt and contains correct emojis in the JS bundle
</verification>

<success_criteria>
Entry form's HomelabScale component displays laptop emoji for "The spare laptop era" (level 3) and money-mouth face emoji for "My partner asks about the electricity bill" (level 4). Frontend bundle is rebuilt to reflect this.
</success_criteria>

<output>
After completion, create `.planning/quick/260323-krb-update-homelab-level-emojis-on-entry-for/260323-krb-SUMMARY.md`
</output>
