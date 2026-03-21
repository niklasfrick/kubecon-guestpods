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

/**
 * Custom D3 force that pushes entire clusters apart when their centroids
 * are too close. Prevents namespace hulls from overlapping.
 *
 * @param strength - Repulsion strength (0..1). Default 0.8.
 * @param minDistance - Minimum distance between cluster centroids before repulsion kicks in. Default 150.
 */
export function clusterRepulsionForce(strength = 0.8, minDistance = 150) {
  let nodes: PodNode[] = [];

  function force(alpha: number) {
    // Compute cluster centroids and sizes
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

    // For each pair of clusters, compute repulsion
    const clusterIds = Array.from(clusters.keys());
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const a = clusters.get(clusterIds[i])!;
        const b = clusters.get(clusterIds[j])!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = 1; dy = 0; dist = 1; } // avoid division by zero

        // Scale minDistance by cluster sizes (larger clusters need more space)
        const sizeScale = Math.sqrt(a.count + b.count) * 0.5;
        const effectiveMin = minDistance * Math.max(1, sizeScale);

        if (dist < effectiveMin) {
          const push = (effectiveMin - dist) / dist * alpha * strength;
          const pushX = dx * push;
          const pushY = dy * push;

          // Push each node in cluster A away from B, and vice versa
          for (const node of nodes) {
            if (node.clusterId === clusterIds[i]) {
              node.vx! -= pushX / a.count;
              node.vy! -= pushY / a.count;
            } else if (node.clusterId === clusterIds[j]) {
              node.vx! += pushX / b.count;
              node.vy! += pushY / b.count;
            }
          }
        }
      }
    }
  }

  force.initialize = (n: PodNode[]) => { nodes = n; };
  return force;
}
