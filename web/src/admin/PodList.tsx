import type { SubmitResponse } from '../api';
import { PodRow } from './PodRow';

interface PodListProps {
  pods: SubmitResponse[];
  onDelete: (id: number) => void;
}

export function PodList({ pods, onDelete }: PodListProps) {
  return (
    <div class="admin-pod-list">
      <div class="pod-list-header">
        Live Pod Feed ({pods.length})
      </div>
      {pods.length === 0 ? (
        <div class="admin-empty">
          <h3>No pods in the cluster</h3>
          <p>Pods will appear here as attendees submit the guestbook form.</p>
        </div>
      ) : (
        pods.map(pod => (
          <PodRow key={pod.id} pod={pod} onDelete={onDelete} />
        ))
      )}
    </div>
  );
}
