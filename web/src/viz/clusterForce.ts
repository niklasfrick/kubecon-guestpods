import type { PodNode } from './types';

/**
 * Custom D3 force that pulls nodes toward their cluster centroid.
 * Larger clusters (more nodes) get positioned closer to the canvas center
 * via stronger forceX/forceY (handled externally). This force handles
 * intra-cluster cohesion.
 *
 * @param strength - How strongly nodes are pulled toward cluster centroid (0..1). Default 0.15.
 */
export function clusterForce(strength = 0.15) {
  let nodes: PodNode[] = [];

  function force(alpha: number) {
    // Compute cluster centroids
    const clusters = new Map<string, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const c = clusters.get(node.clusterId);
      if (c) {
        c.x += node.x;
        c.y += node.y;
        c.count++;
      } else {
        clusters.set(node.clusterId, { x: node.x, y: node.y, count: 1 });
      }
    }
    for (const c of clusters.values()) {
      c.x /= c.count;
      c.y /= c.count;
    }

    // Pull nodes toward their cluster centroid
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const c = clusters.get(node.clusterId);
      if (!c) continue;
      node.vx! += (c.x - node.x) * alpha * strength;
      node.vy! += (c.y - node.y) * alpha * strength;
    }
  }

  force.initialize = (n: PodNode[]) => {
    nodes = n;
  };

  return force;
}
