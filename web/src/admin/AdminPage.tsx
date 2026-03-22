import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { SubmitResponse } from '../api';
import { fetchSubmissions } from '../api';
import { checkSession, getStats, deleteSubmission } from './adminApi';
import type { AdminStats } from './adminApi';
import { LoginForm } from './LoginForm';
import { ToggleButton } from './ToggleButton';
import { StatsPanel } from './StatsPanel';
import { PodList } from './PodList';

type AuthState = 'checking' | 'login' | 'dashboard';

const authState = signal<AuthState>('checking');
const isOpen = signal(true);
const pods = signal<SubmitResponse[]>([]);
const totalPods = signal(0);
const namespaceCount = signal(0);
const topLocations = signal<AdminStats['top_locations']>([]);
const errorBanner = signal<string | null>(null);

function recomputeStats(podList: SubmitResponse[]) {
  totalPods.value = podList.length;
  const nsSet = new Set(podList.map(p => p.country_code));
  namespaceCount.value = nsSet.size;

  // Compute top locations from pod list
  const counts = new Map<string, { country_code: string; country_flag: string; count: number }>();
  for (const p of podList) {
    const existing = counts.get(p.country_code);
    if (existing) {
      existing.count++;
    } else {
      counts.set(p.country_code, {
        country_code: p.country_code,
        country_flag: p.country_flag,
        count: 1,
      });
    }
  }
  topLocations.value = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function AdminPage() {
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Auth check on mount
  useEffect(() => {
    checkSession()
      .then((status) => {
        isOpen.value = status.submissions_open;
        authState.value = 'dashboard';
      })
      .catch(() => {
        authState.value = 'login';
      });
  }, []);

  // Load initial data + SSE when dashboard is shown
  useEffect(() => {
    if (authState.value !== 'dashboard') return;

    let sseCleanup: (() => void) | null = null;

    async function loadData() {
      try {
        // Load stats and pods in parallel
        const [stats, submissions] = await Promise.all([
          getStats(),
          fetchSubmissions(),
        ]);

        isOpen.value = stats.submissions_open;
        totalPods.value = stats.total_pods;
        namespaceCount.value = stats.namespace_count;
        topLocations.value = stats.top_locations;

        // Sort reverse-chronological (newest first)
        pods.value = submissions.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } catch {
        errorBanner.value = 'Control plane error. Retrying automatically.';
        setTimeout(() => { errorBanner.value = null; }, 5000);
      }
    }

    loadData();

    // SSE for real-time updates
    const es = new EventSource('/api/submissions/stream');

    es.addEventListener('submission', (event: MessageEvent) => {
      try {
        const data: SubmitResponse = JSON.parse(event.data);
        // Prepend (newest first), deduplicate
        const current = pods.value;
        if (current.some(p => p.id === data.id)) return;
        const updated = [data, ...current];
        pods.value = updated;
        recomputeStats(updated);
      } catch (e) {
        console.error('Failed to parse SSE submission:', e);
      }
    });

    es.addEventListener('deletion', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const updated = pods.value.filter(p => p.id !== data.id);
        pods.value = updated;
        recomputeStats(updated);
      } catch (e) {
        console.error('Failed to parse SSE deletion:', e);
      }
    });

    es.addEventListener('state', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        isOpen.value = data.submissions_open;
      } catch (e) {
        console.error('Failed to parse SSE state:', e);
      }
    });

    es.onerror = () => {
      console.warn('Admin SSE connection error, will auto-reconnect');
    };

    sseCleanup = () => es.close();

    // Focus toggle button after mount
    setTimeout(() => toggleRef.current?.focus(), 100);

    return () => {
      sseCleanup?.();
    };
  }, [authState.value]);

  function handleLogin() {
    isOpen.value = true;
    authState.value = 'dashboard';
  }

  function handleToggle(newState: boolean) {
    isOpen.value = newState;
  }

  async function handleDelete(id: number) {
    // Optimistic removal
    const previous = pods.value;
    const updated = previous.filter(p => p.id !== id);
    pods.value = updated;
    recomputeStats(updated);

    try {
      await deleteSubmission(id);
    } catch {
      // Revert on error
      pods.value = previous;
      recomputeStats(previous);
      errorBanner.value = 'Control plane error. Retrying automatically.';
      setTimeout(() => { errorBanner.value = null; }, 5000);
    }
  }

  if (authState.value === 'checking') {
    return <div class="admin-checking">Checking session...</div>;
  }

  if (authState.value === 'login') {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div class="admin-page">
      {errorBanner.value && (
        <div class="error-banner">{errorBanner.value}</div>
      )}

      <div class="admin-header">
        <h1 class="admin-heading">Cluster Admin</h1>
        <div class="admin-status" aria-live="polite">
          <span class={`admin-status-dot ${isOpen.value ? 'open' : 'closed'}`} />
          <span>{isOpen.value ? 'Accepting pods' : 'Rejecting pods'}</span>
        </div>
      </div>

      <ToggleButton isOpen={isOpen.value} onToggle={handleToggle} />

      <StatsPanel
        totalPods={totalPods.value}
        namespaceCount={namespaceCount.value}
        topLocations={topLocations.value}
      />

      <PodList pods={pods.value} onDelete={handleDelete} />
    </div>
  );
}
