import type { PodNode } from './types';

type ActivateCallback = (pod: PodNode) => void;

/**
 * Manages staggered pod entrance animations.
 *
 * Pods are queued and activated one-by-one with a configurable delay.
 * When >20 pods are pending, excess pods are batched (process 20 at a time).
 *
 * Initial load uses 50ms stagger; SSE arrivals use 200ms stagger
 * (per UI-SPEC Entrance Animation Specification).
 */
export class AnimationQueue {
  private queue: PodNode[] = [];
  private active = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  public staggerMs: number;
  public onActivate: ActivateCallback = () => {};

  constructor(staggerMs = 200) {
    this.staggerMs = staggerMs;
  }

  /** Add pods to the entrance queue. Starts flushing if not already active. */
  enqueue(pods: PodNode[]): void {
    this.queue.push(...pods);
    if (!this.active) this.flush();
  }

  private flush(): void {
    this.active = true;
    this.processNext();
  }

  private processNext(): void {
    if (this.queue.length === 0) {
      this.active = false;
      return;
    }

    const pod = this.queue.shift()!;
    pod.animStartTime = performance.now();
    pod.animProgress = 0;
    pod.glowOpacity = 1;
    this.onActivate(pod);

    this.timerId = setTimeout(() => this.processNext(), this.staggerMs);
  }

  /** Stop processing and clear the queue. */
  destroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.queue = [];
    this.active = false;
  }
}
