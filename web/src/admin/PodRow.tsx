import type { SubmitResponse } from '../api';

interface PodRowProps {
  pod: SubmitResponse;
  onDelete: (id: number) => void;
}

function relativeTime(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function PodRow({ pod, onDelete }: PodRowProps) {
  function handleDelete() {
    if (window.confirm('Delete this pod?')) {
      onDelete(pod.id);
    }
  }

  return (
    <div class="pod-row">
      <span class="pod-row-emoji">{pod.homelab_emoji}</span>
      <span class="pod-row-name">{pod.name}</span>
      <span class="pod-row-ns">ns/{pod.country_code}</span>
      <span class="pod-row-time">{relativeTime(pod.created_at)}</span>
      <button
        class="pod-row-delete"
        aria-label={`Delete pod ${pod.name}`}
        onClick={handleDelete}
      >
        x
      </button>
    </div>
  );
}
