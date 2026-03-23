import { useRef, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { fetchSubmissions } from '../api';
import type { SubmitResponse } from '../api';
import { appView } from '../app';
import type { PodNode } from './types';
import { createSimulation, toPodNode, addNodes, precomputeLayout, updateCenter } from './simulation';
import { drawFrame, updateAnimations, computeStats } from './renderer';
import { AnimationQueue } from './animationQueue';
import { connectSSE } from './sseClient';
import { BG_COLOR } from './colors';
import { StatsOverlay } from './StatsOverlay';
import { HoverCard, hoveredPod, hoverPos } from './HoverCard';

/** Pan/zoom view transform applied to all canvas drawing. */
interface ViewTransform {
  x: number;  // pan offset in screen pixels
  y: number;  // pan offset in screen pixels
  k: number;  // zoom scale (1 = 100%, 0.5 = zoomed out, 2 = zoomed in)
}

/** Reactive stats for the DOM overlay (updated from render loop). */
export const podCount = signal(0);
export const nsCount = signal(0);

/** Current user info from localStorage (set after form submission). */
const storedSubmission = localStorage.getItem('guestbook_submission');
const parsedSubmission = storedSubmission ? JSON.parse(storedSubmission) as SubmitResponse : null;
export const currentUserId = signal<number | null>(parsedSubmission?.id ?? null);
export const currentUserInfo = signal<{ name: string; countryFlag: string; homelabEmoji: string } | null>(
  parsedSubmission ? { name: parsedSubmission.name, countryFlag: parsedSubmission.country_flag, homelabEmoji: parsedSubmission.homelab_emoji } : null
);

/** Check if user prefers reduced motion. */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function VizPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Canvas sizing ---
    let cssWidth = window.innerWidth;
    let cssHeight = window.innerHeight;

    function resizeCanvas() {
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = cssWidth * dpr;
      canvas!.height = cssHeight * dpr;
      canvas!.style.width = cssWidth + 'px';
      canvas!.style.height = cssHeight + 'px';
      ctx!.setTransform(1, 0, 0, 1, 0, 0); // reset transform before scaling
      ctx!.scale(dpr, dpr);
    }
    resizeCanvas();

    // --- Simulation ---
    const sim = createSimulation(cssWidth, cssHeight);
    let allNodes: PodNode[] = [];

    // --- View transform (pan/zoom) ---
    const viewTransform: ViewTransform = { x: 0, y: 0, k: 1 };
    let userInteracting = false;
    let userInteractTimeout: ReturnType<typeof setTimeout> | null = null;

    /** Mark that user is manually controlling the camera; auto-fit resumes after 3s idle. */
    function markUserInteraction() {
      userInteracting = true;
      if (userInteractTimeout) clearTimeout(userInteractTimeout);
      userInteractTimeout = setTimeout(() => { userInteracting = false; }, 3000);
    }

    // --- Animation Queue ---
    const queue = new AnimationQueue(50); // Start with 50ms for initial load
    queue.onActivate = (pod: PodNode) => {
      if (prefersReducedMotion) {
        // Skip animation -- instant appear
        pod.animProgress = 1;
        pod.glowOpacity = 0;
      }
      // Node is already in allNodes via addNodes; the activate just starts its animation
    };

    // --- Render loop ---
    let animFrameId = 0;
    let running = true;

    function render() {
      if (!running) return;

      const now = performance.now();

      // Tick the simulation (manual stepping since we called sim.stop())
      sim.tick();

      // Update entrance animations
      if (!prefersReducedMotion) {
        updateAnimations(allNodes, now);
      }

      // --- Continuous auto-fit (unless user is interacting) ---
      // Fits camera to the core ~85% of nodes (by distance from weighted center).
      // Small outlier clusters at the edges don't force premature zoom-out.
      if (!userInteracting) {
        const visible = allNodes.filter(n => n.x != null && n.y != null && (n.animProgress > 0 || n.animStartTime > 0));
        if (visible.length > 0) {
          // Weighted center biased toward bigger clusters
          const clusterSizes = new Map<string, number>();
          for (const n of visible) {
            clusterSizes.set(n.clusterId, (clusterSizes.get(n.clusterId) || 0) + 1);
          }
          let wcx = 0, wcy = 0, totalWeight = 0;
          for (const n of visible) {
            const w = clusterSizes.get(n.clusterId)!;
            wcx += n.x! * w;
            wcy += n.y! * w;
            totalWeight += w;
          }
          wcx /= totalWeight;
          wcy /= totalWeight;

          // Sort by distance from weighted center, take 85%
          visible.sort((a, b) => {
            const da = (a.x! - wcx) ** 2 + (a.y! - wcy) ** 2;
            const db = (b.x! - wcx) ** 2 + (b.y! - wcy) ** 2;
            return da - db;
          });
          const fitNodes = visible.slice(0, Math.ceil(visible.length * 0.85));

          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const n of fitNodes) {
            minX = Math.min(minX, n.x!);
            maxX = Math.max(maxX, n.x!);
            minY = Math.min(minY, n.y!);
            maxY = Math.max(maxY, n.y!);
          }
          const pad = 60;
          const worldW = maxX - minX + pad * 2;
          const worldH = maxY - minY + pad * 2;
          // Stay at 1:1 until content overflows, then zoom out
          const targetK = Math.min(cssWidth / worldW, cssHeight / worldH, 1);
          const targetX = cssWidth / 2 - wcx * targetK;
          const targetY = cssHeight / 2 - wcy * targetK;

          // Smooth lerp toward target
          const lerp = 0.05;
          viewTransform.k += (targetK - viewTransform.k) * lerp;
          viewTransform.x += (targetX - viewTransform.x) * lerp;
          viewTransform.y += (targetY - viewTransform.y) * lerp;
        }
      }

      // Draw everything (with pan/zoom transform)
      drawFrame(ctx!, allNodes, cssWidth, cssHeight, viewTransform);

      // Update stats signals (for overlay)
      const stats = computeStats(allNodes);
      podCount.value = stats.podCount;
      nsCount.value = stats.nsCount;

      // Update canvas aria-label
      canvas!.setAttribute(
        'aria-label',
        `Live visualization of ${stats.podCount} attendee pods in ${stats.nsCount} namespace clusters`
      );

      animFrameId = requestAnimationFrame(render);
    }

    // --- Initial load ---
    let sseCleanup: (() => void) | null = null;

    async function init() {
      try {
        const submissions = await fetchSubmissions();
        if (submissions.length > 0) {
          const nodes = submissions.map(toPodNode);
          allNodes = nodes;

          // Pre-compute layout (200 ticks, synchronous)
          precomputeLayout(sim, allNodes);

          // Show existing nodes instantly (no entrance animation)
          const now = performance.now();
          for (const node of allNodes) {
            node.animProgress = 1;
            node.glowOpacity = 0;
            node.animStartTime = now;
          }

          // SSE stagger speed for new arrivals only
          queue.staggerMs = 200;
        }
      } catch (e) {
        console.error('Failed to load submissions:', e);
        // Visualization still works -- will pick up SSE events
      }

      // Start render loop
      animFrameId = requestAnimationFrame(render);

      // Connect SSE for real-time updates (submission, deletion, clear events)
      const closeSSE = connectSSE(
        // onSubmission
        (data: SubmitResponse) => {
          const newNode = toPodNode(data);
          // Check for duplicate (already loaded via initial fetch)
          if (allNodes.some(n => n.id === newNode.id)) return;
          allNodes = addNodes(sim, allNodes, [newNode]);
          queue.enqueue([newNode]);
        },
        // onDeletion
        (data: { id: number }) => {
          const idx = allNodes.findIndex(n => n.id === data.id);
          if (idx !== -1) {
            allNodes = allNodes.filter(n => n.id !== data.id);
            sim.nodes(allNodes);
            sim.alpha(0.1).restart();

            if (hoveredPod.value && hoveredPod.value.id === data.id) {
              hoveredPod.value = null;
            }
          }
        },
        // onState — when admin toggles submissions, update attendee view
        (data: { submissions_open: boolean }) => {
          if (data.submissions_open) {
            appView.value = 'form';
          }
        },
        // onClear
        () => {
          allNodes = [];
          sim.nodes(allNodes);
          sim.alpha(0).stop();
          hoveredPod.value = null;
        }
      );

      // Store cleanup for SSE
      sseCleanup = closeSSE;
    }

    init();

    // --- Pan/zoom handlers ---
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTX = 0;
    let panStartTY = 0;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      markUserInteraction();

      const rect = canvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom toward/away from mouse position
      const zoomFactor = e.deltaY > 0 ? 0.97 : 1.03;
      const newK = Math.max(0.1, Math.min(5, viewTransform.k * zoomFactor));

      // Adjust pan so the point under the mouse stays fixed
      viewTransform.x = mouseX - (mouseX - viewTransform.x) * (newK / viewTransform.k);
      viewTransform.y = mouseY - (mouseY - viewTransform.y) * (newK / viewTransform.k);
      viewTransform.k = newK;
    }

    function onMouseDown(e: MouseEvent) {
      // Only pan with left mouse button
      if (e.button !== 0) return;
      markUserInteraction();
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartTX = viewTransform.x;
      panStartTY = viewTransform.y;
      canvas!.style.cursor = 'grabbing';
    }

    function onMouseUp(_e: MouseEvent) {
      if (isPanning) {
        isPanning = false;
        canvas!.style.cursor = 'default';
      }
    }

    function onMouseMoveGlobal(e: MouseEvent) {
      if (isPanning) {
        viewTransform.x = panStartTX + (e.clientX - panStartX);
        viewTransform.y = panStartTY + (e.clientY - panStartY);
      }
    }

    // --- Touch handlers (mobile pan/zoom) ---
    let lastTouchDist = 0;
    let lastTouchMid = { x: 0, y: 0 };
    let isTouchPanning = false;
    let touchPanStartX = 0;
    let touchPanStartY = 0;
    let touchPanStartTX = 0;
    let touchPanStartTY = 0;

    function getTouchDist(t1: Touch, t2: Touch) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      markUserInteraction();
      if (e.touches.length === 1) {
        // Single finger: pan
        isTouchPanning = true;
        touchPanStartX = e.touches[0].clientX;
        touchPanStartY = e.touches[0].clientY;
        touchPanStartTX = viewTransform.x;
        touchPanStartTY = viewTransform.y;
      } else if (e.touches.length === 2) {
        // Two fingers: pinch-to-zoom
        isTouchPanning = false;
        lastTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        const rect = canvas!.getBoundingClientRect();
        lastTouchMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 1 && isTouchPanning) {
        viewTransform.x = touchPanStartTX + (e.touches[0].clientX - touchPanStartX);
        viewTransform.y = touchPanStartTY + (e.touches[0].clientY - touchPanStartY);
      } else if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const rect = canvas!.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        if (lastTouchDist > 0) {
          const scale = dist / lastTouchDist;
          const newK = Math.max(0.1, Math.min(5, viewTransform.k * scale));
          viewTransform.x = midX - (midX - viewTransform.x) * (newK / viewTransform.k);
          viewTransform.y = midY - (midY - viewTransform.y) * (newK / viewTransform.k);
          viewTransform.k = newK;
        }

        lastTouchDist = dist;
        lastTouchMid = { x: midX, y: midY };
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        isTouchPanning = false;
        lastTouchDist = 0;
      } else if (e.touches.length === 1) {
        // Went from 2 fingers to 1: start panning from current position
        isTouchPanning = true;
        touchPanStartX = e.touches[0].clientX;
        touchPanStartY = e.touches[0].clientY;
        touchPanStartTX = viewTransform.x;
        touchPanStartTY = viewTransform.y;
      }
    }

    canvas!.addEventListener('wheel', onWheel, { passive: false });
    canvas!.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMoveGlobal);
    canvas!.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas!.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas!.addEventListener('touchend', onTouchEnd);

    // --- Hover detection ---
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    function onMouseMove(e: MouseEvent) {
      if (isPanning) return; // Don't hover while panning

      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert screen coords to world (simulation) coords
      const worldX = (x - viewTransform.x) / viewTransform.k;
      const worldY = (y - viewTransform.y) / viewTransform.k;
      const found = sim.find(worldX, worldY, 20 / viewTransform.k) as PodNode | undefined;

      if (found && found.animProgress > 0) {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        hoveredPod.value = found;
        // Convert world position to screen position for HoverCard
        const screenX = found.x! * viewTransform.k + viewTransform.x;
        const screenY = found.y! * viewTransform.k + viewTransform.y;
        hoverPos.value = { x: screenX, y: screenY };
        canvas!.style.cursor = 'pointer';
      } else {
        // 100ms hide delay to prevent flicker (per UI-SPEC)
        if (!hideTimeout) {
          hideTimeout = setTimeout(() => {
            hoveredPod.value = null;
            hideTimeout = null;
          }, 100);
        }
        if (!isPanning) canvas!.style.cursor = 'default';
      }
    }

    canvas!.addEventListener('mousemove', onMouseMove);

    // --- Resize handler ---
    let resizeTimer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        updateCenter(sim, cssWidth, cssHeight);
      }, 200);
    }
    window.addEventListener('resize', onResize);

    // --- Cleanup ---
    return () => {
      running = false;
      cancelAnimationFrame(animFrameId);
      sim.stop();
      queue.destroy();
      sseCleanup?.();
      canvas!.removeEventListener('wheel', onWheel);
      canvas!.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMoveGlobal);
      canvas!.removeEventListener('mousemove', onMouseMove);
      canvas!.removeEventListener('touchstart', onTouchStart);
      canvas!.removeEventListener('touchmove', onTouchMove);
      canvas!.removeEventListener('touchend', onTouchEnd);
      if (hideTimeout) clearTimeout(hideTimeout);
      if (userInteractTimeout) clearTimeout(userInteractTimeout);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Live visualization of 0 attendee pods in 0 namespace clusters"
        style={{
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0,
        }}
      />
      <StatsOverlay />
      <HoverCard />
    </div>
  );
}
