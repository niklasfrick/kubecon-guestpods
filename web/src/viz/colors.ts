/** Pod fill colors by homelab level. From UI-SPEC Pod Colors table. */
export const LEVEL_COLORS: Record<number, string> = {
  1: '#60a5fa', // Soft blue  - Level 1: "What's a homelab?"
  2: '#fb7185', // Pink/coral - Level 2: "A Pi and a dream"
  3: '#fbbf24', // Amber      - Level 3: "The spare laptop era"
  4: '#2dd4bf', // Teal       - Level 4: "Electricity bill"
  5: '#a78bfa', // Purple     - Level 5: "On-call rotation"
};

/** Homelab level descriptions for HoverCard. From Phase 1 CONTEXT.md. */
export const HOMELAB_DESCRIPTIONS: Record<number, string> = {
  1: "What's a homelab?",
  2: 'A Pi and a dream',
  3: 'The spare laptop era',
  4: 'My partner asks about the electricity bill',
  5: 'I have an on-call rotation for my house',
};

/** Canvas background color. From UI-SPEC Screen Layout. */
export const BG_COLOR = '#0f172a';

/** Cluster boundary fill. From UI-SPEC Namespace Cluster Visual Specification. */
export const CLUSTER_FILL = 'rgba(148, 163, 184, 0.12)';

/** Namespace badge background. From UI-SPEC. */
export const BADGE_BG = 'rgba(15, 23, 42, 0.85)';

/** System font stack matching Phase 1 --font-family CSS custom property. */
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Emoji font stack for reliable cross-platform emoji rendering. */
export const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/** Pod dimensions in CSS pixels. From UI-SPEC Pod Visual Specification. */
export const POD_WIDTH = 60;
export const POD_HEIGHT = 30;
export const POD_RADIUS = 6;
