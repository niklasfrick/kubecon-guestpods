import { useRef, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { fetchSubmissions } from '../api';
import type { SubmitResponse } from '../api';
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

          // Auto-fit: compute bounding box and set transform to fit all clusters
          if (allNodes.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const n of allNodes) {
              if (n.x != null && n.y != null) {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y);
              }
            }
            const worldW = maxX - minX + 200; // 100px padding on each side
            const worldH = maxY - minY + 200;
            const scaleX = cssWidth / worldW;
            const scaleY = cssHeight / worldH;
            const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            viewTransform.k = fitScale;
            viewTransform.x = cssWidth / 2 - centerX * fitScale;
            viewTransform.y = cssHeight / 2 - centerY * fitScale;
          }

          // Cascade the visual entrance
          queue.enqueue([...allNodes]);

          // After cascade, switch to SSE stagger speed
          const cascadeTime = allNodes.length * 50 + 500;
          setTimeout(() => {
            queue.staggerMs = 200;
          }, cascadeTime);
        }
      } catch (e) {
        console.error('Failed to load submissions:', e);
        // Visualization still works -- will pick up SSE events
      }

      // Start render loop
      animFrameId = requestAnimationFrame(render);

      // Connect SSE for real-time updates
      const closeSSE = connectSSE((data: SubmitResponse) => {
        const newNode = toPodNode(data);
        // Check for duplicate (already loaded via initial fetch)
        if (allNodes.some(n => n.id === newNode.id)) return;
        allNodes = addNodes(sim, allNodes, [newNode]);
        queue.enqueue([newNode]);
      });

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

      const rect = canvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom toward/away from mouse position
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newK = Math.max(0.1, Math.min(5, viewTransform.k * zoomFactor));

      // Adjust pan so the point under the mouse stays fixed
      viewTransform.x = mouseX - (mouseX - viewTransform.x) * (newK / viewTransform.k);
      viewTransform.y = mouseY - (mouseY - viewTransform.y) * (newK / viewTransform.k);
      viewTransform.k = newK;
    }

    function onMouseDown(e: MouseEvent) {
      // Only pan with left mouse button
      if (e.button !== 0) return;
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

    canvas!.addEventListener('wheel', onWheel, { passive: false });
    canvas!.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMoveGlobal);

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
      if (hideTimeout) clearTimeout(hideTimeout);
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
