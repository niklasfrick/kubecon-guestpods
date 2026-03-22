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
 * Size-weighted centering: bigger clusters get pulled toward canvas center
 * more strongly, keeping them prominent and central.
 */
export function clusterCenterForce(cx: number, cy: number, baseStrength = 0.01) {
  let nodes: PodNode[] = [];

  function force(alpha: number) {
    // Count cluster sizes
    const sizes = new Map<string, number>();
    for (const node of nodes) {
      sizes.set(node.clusterId, (sizes.get(node.clusterId) || 0) + 1);
    }
    const maxSize = Math.max(...sizes.values(), 1);

    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      // Strength scales with relative cluster size: biggest cluster gets 3x base
      const size = sizes.get(node.clusterId) || 1;
      const s = baseStrength * (1 + 2 * (size / maxSize));
      node.vx! += (cx - node.x) * alpha * s;
      node.vy! += (cy - node.y) * alpha * s;
    }
  }

  force.initialize = (n: PodNode[]) => { nodes = n; };

  // Allow updating center position on resize
  force.cx = (v: number) => { cx = v; return force; };
  force.cy = (v: number) => { cy = v; return force; };

  return force;
}

/**
 * Radius-aware cluster repulsion force. Computes the actual spatial extent
 * of each cluster (max node distance from centroid) and pushes clusters apart
 * so their boundaries maintain a consistent gap.
 *
 * @param strength - Repulsion strength (0..1). Default 0.8.
 * @param padding - Gap in pixels between cluster edges. Default 60.
 */
export function clusterRepulsionForce(strength = 0.8, padding = 60) {
  let nodes: PodNode[] = [];

  function force(alpha: number) {
    // Compute cluster centroids
    const clusters = new Map<string, { cx: number; cy: number; count: number; radius: number }>();
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const c = clusters.get(node.clusterId);
      if (c) {
        c.cx += node.x;
        c.cy += node.y;
        c.count++;
      } else {
        clusters.set(node.clusterId, { cx: node.x, cy: node.y, count: 1, radius: 0 });
      }
    }
    for (const c of clusters.values()) {
      c.cx /= c.count;
      c.cy /= c.count;
    }

    // Compute actual radius of each cluster (max node distance from centroid)
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const c = clusters.get(node.clusterId);
      if (!c) continue;
      const dx = node.x - c.cx;
      const dy = node.y - c.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > c.radius) c.radius = d;
    }

    // For each pair of clusters, repel if edges overlap or are too close
    const clusterIds = Array.from(clusters.keys());
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const a = clusters.get(clusterIds[i])!;
        const b = clusters.get(clusterIds[j])!;
        let dx = b.cx - a.cx;
        let dy = b.cy - a.cy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = 1; dy = 0; dist = 1; }

        // Min distance = sum of radii + padding gap
        const minDist = a.radius + b.radius + padding;

        if (dist < minDist) {
          // Alpha floor: repulsion must stay effective even as simulation cools,
          // otherwise centering forces compress clusters back together.
          const effectiveAlpha = Math.max(alpha, 0.1);
          const push = (minDist - dist) / dist * effectiveAlpha * strength;
          const pushX = dx * push;
          const pushY = dy * push;

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
