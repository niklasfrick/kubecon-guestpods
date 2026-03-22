interface StatsPanelProps {
  totalPods: number;
  namespaceCount: number;
  topLocations: Array<{ country_code: string; country_flag: string; count: number }>;
}

export function StatsPanel({ totalPods, namespaceCount, topLocations }: StatsPanelProps) {
  return (
    <div class="admin-stats">
      <div class="stat-item">
        <span class="stat-value">{totalPods}</span>
        <span class="stat-label">Total Pods</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{namespaceCount}</span>
        <span class="stat-label">Namespaces</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Top Locations</span>
        <span class="stat-locations">
          {topLocations.length > 0
            ? topLocations.map(l => `${l.country_flag} ${l.country_code} (${l.count})`).join('  ')
            : 'No data yet'}
        </span>
      </div>
    </div>
  );
}
