import { forceSimulation, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force';
import type { Simulation } from 'd3-force';
import type { PodNode } from './types';
import type { SubmitResponse } from '../api';
import { clusterForce } from './clusterForce';

/** Convert a SubmitResponse from the API into a PodNode for the simulation. */
export function toPodNode(s: SubmitResponse): PodNode {
  return {
    id: s.id,
    name: s.name,
    countryCode: s.country_code,
    countryFlag: s.country_flag,
    homelabLevel: s.homelab_level,
    homelabEmoji: s.homelab_emoji,
    clusterId: s.country_code,
    animProgress: 0,
    animStartTime: 0,
    glowOpacity: 0,
  };
}

/**
 * Create the D3 force simulation with all forces configured.
 * Forces: charge (repulsion), collide (no overlap), center (centering),
 * cluster (custom cohesion), x/y (size-based gravity toward center).
 */
export function createSimulation(
  width: number,
  height: number
): Simulation<PodNode, undefined> {
  const sim = forceSimulation<PodNode>([])
    .force('charge', forceManyBody<PodNode>().strength(-30).distanceMax(200))
    .force('collide', forceCollide<PodNode>().radius(35).iterations(2))
    .force('center', forceCenter(width / 2, height / 2).strength(0.05))
    .force('cluster', clusterForce(0.15))
    .force('x', forceX<PodNode>(width / 2).strength(0.02))
    .force('y', forceY<PodNode>(height / 2).strength(0.02))
    .alphaDecay(0.02)
    .velocityDecay(0.3)
    .stop(); // We drive ticks manually via requestAnimationFrame

  return sim;
}

/**
 * Add new nodes to an existing simulation.
 * Uses gentle reheat (alpha 0.3) to make room for new pods without
 * disrupting the existing layout (per RESEARCH.md Pitfall 1).
 */
export function addNodes(
  sim: Simulation<PodNode, undefined>,
  existingNodes: PodNode[],
  newNodes: PodNode[]
): PodNode[] {
  const allNodes = [...existingNodes, ...newNodes];
  sim.nodes(allNodes);
  sim.alpha(0.3).restart();
  return allNodes;
}

/**
 * Pre-compute layout for initial load.
 * Adds all nodes to simulation and runs 120 ticks synchronously
 * to settle the layout before visual cascade begins (per RESEARCH.md Pitfall 6).
 */
export function precomputeLayout(
  sim: Simulation<PodNode, undefined>,
  nodes: PodNode[]
): void {
  sim.nodes(nodes);
  sim.alpha(1);
  for (let i = 0; i < 120; i++) {
    sim.tick();
  }
  // After pre-computation, set low alpha so it stays mostly settled
  sim.alpha(0.05);
}

/**
 * Update the center force when the canvas is resized.
 */
export function updateCenter(
  sim: Simulation<PodNode, undefined>,
  width: number,
  height: number
): void {
  const center = sim.force('center') as ReturnType<typeof forceCenter> | null;
  if (center) {
    center.x(width / 2).y(height / 2);
  }
  const fx = sim.force('x') as ReturnType<typeof forceX> | null;
  const fy = sim.force('y') as ReturnType<typeof forceY> | null;
  if (fx) fx.x(width / 2);
  if (fy) fy.y(height / 2);
  sim.alpha(0.3).restart();
}
