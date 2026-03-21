import { podCount, nsCount } from './VizPage';

/**
 * Live stats overlay in top-left corner.
 * Displays: "{N} pods {middot} {N} namespaces"
 *
 * Per UI-SPEC Stats Overlay Specification:
 * - Position: top-left, 16px from edges
 * - Font: 14px, weight 600
 * - Background: rgba(15, 23, 42, 0.80)
 * - Border: 1px solid #334155
 * - Border radius: 8px
 * - Padding: 8px 12px
 */
export function StatsOverlay() {
  return (
    <div class="stats-overlay">
      <span class="stats-count">{podCount.value} pods</span>
      <span class="stats-separator">{'\u00B7'}</span>
      <span class="stats-count">{nsCount.value} namespaces</span>
    </div>
  );
}
