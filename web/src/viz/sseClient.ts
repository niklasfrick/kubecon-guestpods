import type { SubmitResponse } from '../api';

/**
 * Connect to the SSE endpoint for real-time submission events.
 * Returns a cleanup function that closes the connection.
 *
 * EventSource auto-reconnects on error (per MDN spec).
 * Event name is "submission" with JSON SubmitResponse data
 * (per server/sse.go: fmt.Fprintf(w, "event: submission\ndata: %s\n\n", data)).
 */
export function connectSSE(
  onSubmission: (data: SubmitResponse) => void
): () => void {
  const es = new EventSource('/api/submissions/stream');

  es.addEventListener('submission', (event: MessageEvent) => {
    try {
      const data: SubmitResponse = JSON.parse(event.data);
      onSubmission(data);
    } catch (e) {
      console.error('Failed to parse SSE submission:', e);
    }
  });

  es.onerror = () => {
    console.warn('SSE connection error, will auto-reconnect');
  };

  return () => es.close();
}
