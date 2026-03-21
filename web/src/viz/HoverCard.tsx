import { signal } from '@preact/signals';
import type { PodNode } from './types';
import { HOMELAB_DESCRIPTIONS } from './colors';

/** Signal for the currently hovered pod. null = no hover. */
export const hoveredPod = signal<PodNode | null>(null);

/** Signal for hover card position in CSS pixels. */
export const hoverPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

/**
 * HoverCard overlay showing full pod details.
 *
 * Per UI-SPEC Hover Interaction Specification:
 * - Position: 12px to right of pod; flip to left if within 200px of right edge
 * - Max width: 220px
 * - Show delay: 0ms (instant)
 * - Content: emoji + full name, flag ns/CODE, homelab level description
 * - Background: rgba(15, 23, 42, 0.90)
 * - Border: 1px solid #334155
 * - Border radius: 8px
 * - Padding: 12px
 */
export function HoverCard() {
  const pod = hoveredPod.value;
  if (!pod) return null;

  const pos = hoverPos.value;

  // Flip to left side if too close to right viewport edge
  const flipLeft = pos.x > window.innerWidth - 200;
  const left = flipLeft ? pos.x - 220 - 12 : pos.x + 12;
  const top = pos.y - 40; // Center vertically near pod

  // Clamp to viewport
  const clampedTop = Math.max(16, Math.min(top, window.innerHeight - 120));
  const clampedLeft = Math.max(16, left);

  return (
    <div
      class="hover-card"
      style={{
        left: clampedLeft + 'px',
        top: clampedTop + 'px',
      }}
    >
      <div class="hover-card-name">
        {pod.homelabEmoji} {pod.name}
      </div>
      <div class="hover-card-namespace">
        {pod.countryFlag} ns/{pod.countryCode}
      </div>
      <div class="hover-card-level">
        {HOMELAB_DESCRIPTIONS[pod.homelabLevel] || ''}
      </div>
    </div>
  );
}
