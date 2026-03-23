import { podCount, nsCount, currentUserInfo } from './VizPage';

/**
 * Live stats overlay in top-left corner.
 * Displays: "{N} pods {middot} {N} namespaces"
 * Optionally shows user info (emoji, name, flag) on a second line.
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
  const user = currentUserInfo.value;
  return (
    <div class="stats-overlay">
      <div class="stats-main">
        <span class="stats-count">{podCount.value} pods</span>
        <span class="stats-separator">{'\u00B7'}</span>
        <span class="stats-count">{nsCount.value} namespaces</span>
      </div>
      {user && (
        <div class="stats-user">
          {user.homelabEmoji} {user.name} {user.countryFlag}
        </div>
      )}
    </div>
  );
}
