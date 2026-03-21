import type { SimulationNodeDatum } from 'd3-force';

/** A pod node in the D3 force simulation. Extends SimulationNodeDatum
 *  so d3-force can mutate x, y, vx, vy in-place. */
export interface PodNode extends SimulationNodeDatum {
  id: number;
  name: string;
  countryCode: string;
  countryFlag: string;
  homelabLevel: number;
  homelabEmoji: string;
  // D3 force fields (inherited from SimulationNodeDatum but listed for clarity):
  // x?: number; y?: number; vx?: number; vy?: number; fx?: number; fy?: number;

  /** Country code used as the cluster grouping key */
  clusterId: string;
  /** 0..1 entrance animation progress (0 = invisible, 1 = fully visible) */
  animProgress: number;
  /** performance.now() timestamp when entrance animation started; 0 = not started */
  animStartTime: number;
  /** 0..1 glow opacity (fades from 1 to 0 over 2 seconds after entrance) */
  glowOpacity: number;
}

/** Aggregated cluster data computed per-frame from PodNode positions. */
export interface ClusterData {
  id: string;
  countryCode: string;
  countryFlag: string;
  nodes: PodNode[];
  centroidX: number;
  centroidY: number;
}
