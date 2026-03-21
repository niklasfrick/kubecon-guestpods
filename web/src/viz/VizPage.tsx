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

      // Draw everything
      drawFrame(ctx!, allNodes, cssWidth, cssHeight);

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

          // Pre-compute layout (120 ticks, synchronous)
          precomputeLayout(sim, allNodes);

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

    // --- Hover detection ---
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // simulation.find() uses CSS-space coordinates (not pixel-space)
      // per RESEARCH.md Pitfall 7
      const found = sim.find(x, y, 20) as PodNode | undefined;

      if (found && found.animProgress > 0) {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        hoveredPod.value = found;
        hoverPos.value = { x: found.x!, y: found.y! };
        canvas!.style.cursor = 'pointer';
      } else {
        // 100ms hide delay to prevent flicker (per UI-SPEC)
        if (!hideTimeout) {
          hideTimeout = setTimeout(() => {
            hoveredPod.value = null;
            hideTimeout = null;
          }, 100);
        }
        canvas!.style.cursor = 'default';
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
