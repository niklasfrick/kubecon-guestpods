---
phase: quick
plan: 260323-mmn
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release.yaml
autonomous: false
must_haves:
  truths:
    - "Git tag v1.0.0 produces Docker image tagged 1.0.0 at ghcr.io/niklasfrick/kubecon-guestpods"
    - "Helm chart appVersion matches the semver tag so default deployments pull the correct image"
    - "Workflow semver patterns require strict 3-part semver tags (vX.Y.Z) and produce correct image tags"
  artifacts:
    - path: ".github/workflows/release.yaml"
      provides: "Semver-based image tagging with latest fallback"
  key_links:
    - from: ".github/workflows/release.yaml"
      to: "ghcr.io/niklasfrick/kubecon-guestpods"
      via: "docker/metadata-action semver patterns"
      pattern: "type=semver"
    - from: "chart/Chart.yaml"
      to: "chart/templates/_helpers.tpl"
      via: "appVersion used as default image tag"
      pattern: "default .Chart.AppVersion"
---

<objective>
Ensure the GitHub Actions release workflow produces correct Docker image tags that align with what the Helm chart expects when deploying.

Purpose: The current git tag is `v1.0` (2-part), but docker/metadata-action's `type=semver` patterns require strict 3-part semver (vX.Y.Z) to produce output. This means the `v1.0` push likely only produced a SHA-based tag, not the semver tags. The Helm chart's appVersion is `1.0.0`, so it tries to pull `:1.0.0` which may not exist. Fix the alignment between git tagging conventions, workflow tag generation, and Helm chart appVersion.

Output: Updated release workflow ensuring correct image tag alignment.
</objective>

<execution_context>
@/Users/niklas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/niklas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/release.yaml
@chart/Chart.yaml
@chart/values.yaml
@chart/templates/_helpers.tpl
@chart/templates/deployment.yaml
</context>

<interfaces>
<!-- Key patterns the executor needs to understand -->

From chart/templates/_helpers.tpl (image tag resolution):
```
{{- define "guestpods.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end }}
```
When `values.yaml` has `tag: ""`, the image resolves to `ghcr.io/niklasfrick/kubecon-guestpods:{Chart.AppVersion}`.

From chart/Chart.yaml:
```yaml
appVersion: "1.0.0"
```

Current git tags: `v1.0` (only tag -- 2-part, NOT strict semver)

From .github/workflows/release.yaml metadata-action:
```yaml
tags: |
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
  type=sha,prefix=,format=short
```

docker/metadata-action semver behavior:
- `type=semver,pattern={{version}}` on `v1.0.0` -> `1.0.0`
- `type=semver,pattern={{major}}.{{minor}}` on `v1.0.0` -> `1.0`
- On `v1.0` (not strict semver) -> these patterns may not produce output, leaving only SHA tag
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add latest tag and document semver convention in release workflow</name>
  <files>.github/workflows/release.yaml</files>
  <action>
Two changes to `.github/workflows/release.yaml`:

1. **Add `type=raw,value=latest` tag to the metadata-action.** This ensures every release push also produces a `latest` tag as a deployment fallback. Add it after the existing SHA pattern:
   ```yaml
   tags: |
     type=semver,pattern={{version}}
     type=semver,pattern={{major}}.{{minor}}
     type=sha,prefix=,format=short
     type=raw,value=latest
   ```

2. **Document the tagging convention** by adding a comment above the `tags: |` line in the metadata-action step:
   ```yaml
   # IMPORTANT: Git tags MUST be strict 3-part semver (e.g., v1.0.0, v1.1.0)
   # 2-part tags like v1.0 will NOT produce semver image tags, only SHA fallback
   ```

Do NOT modify Chart.yaml, values.yaml, _helpers.tpl, or deployment.yaml -- the tag resolution chain is already correct. The `appVersion: "1.0.0"` in Chart.yaml matches what `type=semver,pattern={{version}}` produces from a `v1.0.0` git tag.
  </action>
  <verify>
    <automated>cd /Users/niklas/Coding/kubecon-guestbook && grep -q "type=raw,value=latest" .github/workflows/release.yaml && grep -q "type=semver,pattern={{version}}" .github/workflows/release.yaml && grep -q "3-part semver" .github/workflows/release.yaml && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Release workflow produces latest tag alongside semver and SHA tags. Convention for 3-part semver git tags is documented in the workflow comments.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify workflow and re-tag for correct image</name>
  <files></files>
  <action>Present the user with the findings and the re-tagging instructions.</action>
  <verify>User confirms the workflow changes and re-tagging plan.</verify>
  <done>User has approved the workflow changes and understands the re-tagging steps needed.</done>
  <what-built>Updated release workflow with latest tag and semver convention documentation. The key finding: the existing git tag is `v1.0` (2-part) which does not produce semver image tags -- only the SHA fallback. To get proper image tagging, you should delete `v1.0` and create `v1.0.0` instead:

  ```bash
  git tag -d v1.0
  git push origin :refs/tags/v1.0
  git tag v1.0.0
  git push origin v1.0.0
  ```

  This will trigger the release workflow and produce tags: `1.0.0`, `1.0`, the short SHA, and `latest` -- all matching what the Helm chart expects (appVersion: "1.0.0").</what-built>
  <how-to-verify>
    1. Review `.github/workflows/release.yaml` -- confirm `type=raw,value=latest` is present and convention comment exists
    2. After pushing a `v1.0.0` tag, check GitHub Actions to confirm the Release workflow runs
    3. Check `ghcr.io/niklasfrick/kubecon-guestpods` packages to confirm image tags `1.0.0`, `1.0`, and `latest` exist
    4. Verify `helm template` output shows the correct image: `ghcr.io/niklasfrick/kubecon-guestpods:1.0.0`
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Release workflow YAML is valid (no syntax errors)
- `type=raw,value=latest` tag pattern present in metadata-action
- Semver convention documented in workflow comments
- Chart.yaml appVersion is `1.0.0` (matches expected `v1.0.0` git tag)
- Helm template resolves image to `ghcr.io/niklasfrick/kubecon-guestpods:1.0.0`
</verification>

<success_criteria>
- GitHub Actions release workflow produces `latest`, semver, and SHA image tags on v* tag push
- Git tagging convention (3-part semver) is documented in workflow
- Helm chart appVersion aligns with expected git tag format
- User has clear instructions for re-tagging v1.0 -> v1.0.0
</success_criteria>

<output>
After completion, create `.planning/quick/260323-mmn-make-sure-the-built-image-via-the-github/260323-mmn-SUMMARY.md`
</output>
