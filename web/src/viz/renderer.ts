import { polygonHull } from 'd3-polygon';
import { easeBackOut } from 'd3-ease';
import type { PodNode, ClusterData } from './types';
import {
  LEVEL_COLORS, BG_COLOR, CLUSTER_FILL, BADGE_BG,
  FONT_STACK, POD_WIDTH, POD_HEIGHT, POD_RADIUS,
} from './colors';

const ANIM_DURATION = 600;   // ms for scale-up animation
const GLOW_DURATION = 2000;  // ms for glow fade-out
const HULL_PADDING = 25;     // px padding around nodes for hull computation

/** Truncate a string to maxLen rune-aware characters, appending ".." if truncated. */
function truncate(s: string, maxLen: number): string {
  const chars = [...s];
  return chars.length > maxLen ? chars.slice(0, maxLen).join('') + '..' : s;
}

/** Group nodes by clusterId and compute centroids. */
function computeClusters(nodes: PodNode[]): ClusterData[] {
  const map = new Map<string, PodNode[]>();
  for (const n of nodes) {
    if (n.animProgress <= 0) continue; // skip invisible nodes
    const arr = map.get(n.clusterId);
    if (arr) arr.push(n);
    else map.set(n.clusterId, [n]);
  }

  const clusters: ClusterData[] = [];
  for (const [id, clusterNodes] of map) {
    let cx = 0, cy = 0;
    for (const n of clusterNodes) {
      cx += n.x!;
      cy += n.y!;
    }
    cx /= clusterNodes.length;
    cy /= clusterNodes.length;
    clusters.push({
      id,
      countryCode: clusterNodes[0].countryCode,
      countryFlag: clusterNodes[0].countryFlag,
      nodes: clusterNodes,
      centroidX: cx,
      centroidY: cy,
    });
  }
  return clusters;
}

/** Update animation progress and glow opacity for all nodes. */
export function updateAnimations(nodes: PodNode[], now: number): void {
  for (const node of nodes) {
    if (node.animStartTime <= 0) continue;
    const elapsed = now - node.animStartTime;

    // Scale-up animation: 0..1 over ANIM_DURATION
    node.animProgress = Math.min(elapsed / ANIM_DURATION, 1);

    // Glow fade: 1..0 over GLOW_DURATION (starts at animStartTime)
    if (elapsed < GLOW_DURATION) {
      node.glowOpacity = 1 - elapsed / GLOW_DURATION;
    } else {
      node.glowOpacity = 0;
    }
  }
}

/** Draw a single pod: rounded-rect with level color, emoji + truncated name, optional glow. */
function drawPod(ctx: CanvasRenderingContext2D, node: PodNode): void {
  const w = POD_WIDTH, h = POD_HEIGHT, r = POD_RADIUS;
  const color = LEVEL_COLORS[node.homelabLevel] || LEVEL_COLORS[1];
  const progress = node.animProgress;

  if (progress <= 0) return;

  const scale = easeBackOut(Math.min(progress, 1));

  ctx.save();
  ctx.translate(node.x!, node.y!);
  ctx.scale(scale, scale);

  // Glow effect (shadowBlur)
  if (node.glowOpacity > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 * node.glowOpacity;
  }

  // Rounded rectangle body
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();

  // Reset shadow for text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Pod label: emoji + truncated name
  ctx.fillStyle = '#ffffff';
  ctx.font = `11px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `${node.homelabEmoji} ${truncate(node.name, 8)}`;
  ctx.fillText(label, 0, 0);

  ctx.restore();
}

/** Draw cluster boundary: convex hull with translucent fill, or padded rect for 1-2 nodes. */
function drawClusterBoundary(ctx: CanvasRenderingContext2D, cluster: ClusterData): void {
  const nodes = cluster.nodes;
  if (nodes.length === 0) return;

  ctx.fillStyle = CLUSTER_FILL;

  if (nodes.length === 1) {
    // Single pod: padded rectangle (110x80 centered on pod per UI-SPEC)
    const n = nodes[0];
    const pw = POD_WIDTH + 2 * HULL_PADDING;  // 110
    const ph = POD_HEIGHT + 2 * HULL_PADDING;  // 80
    ctx.beginPath();
    ctx.roundRect(n.x! - pw / 2, n.y! - ph / 2, pw, ph, 12);
    ctx.fill();
    return;
  }

  if (nodes.length === 2) {
    // Two pods: capsule shape
    const [a, b] = nodes;
    const mx = (a.x! + b.x!) / 2;
    const my = (a.y! + b.y!) / 2;
    const dx = b.x! - a.x!;
    const dy = b.y! - a.y!;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const w = dist + POD_WIDTH + 2 * HULL_PADDING;
    const h = POD_HEIGHT + 2 * HULL_PADDING;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 3+ pods: convex hull
  const points: [number, number][] = [];
  for (const n of nodes) {
    points.push([n.x! - HULL_PADDING, n.y! - HULL_PADDING]);
    points.push([n.x! + HULL_PADDING, n.y! - HULL_PADDING]);
    points.push([n.x! + HULL_PADDING, n.y! + HULL_PADDING]);
    points.push([n.x! - HULL_PADDING, n.y! + HULL_PADDING]);
  }

  const hull = polygonHull(points);
  if (!hull) return;

  ctx.beginPath();
  ctx.moveTo(hull[0][0], hull[0][1]);
  for (let i = 1; i < hull.length; i++) {
    ctx.lineTo(hull[i][0], hull[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

/** Draw namespace label badge above the cluster. */
function drawNamespaceLabel(ctx: CanvasRenderingContext2D, cluster: ClusterData): void {
  const nodes = cluster.nodes;
  if (nodes.length === 0) return;

  // Find the topmost node Y to position label above the cluster
  let topY = Infinity;
  for (const n of nodes) {
    if (n.y! < topY) topY = n.y!;
  }

  const label = `${cluster.countryFlag} ns/${cluster.countryCode}`;
  ctx.font = `600 11px ${FONT_STACK}`;
  const metrics = ctx.measureText(label);
  const padX = 8, padY = 4;
  const labelW = metrics.width + padX * 2;
  const labelH = 18;
  const x = cluster.centroidX - labelW / 2;
  const y = topY - POD_HEIGHT / 2 - HULL_PADDING - labelH - 8; // above hull with gap

  // Dark badge background
  ctx.beginPath();
  ctx.roundRect(x, y, labelW, labelH, 4);
  ctx.fillStyle = BADGE_BG;
  ctx.fill();

  // White label text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cluster.centroidX, y + labelH / 2);
}

/**
 * Draw a complete frame: background, cluster boundaries, namespace labels, pods.
 *
 * @param ctx - Canvas 2D context (already DPI-scaled)
 * @param nodes - All PodNodes (including invisible ones with animProgress=0)
 * @param width - Canvas CSS width in pixels
 * @param height - Canvas CSS height in pixels
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  nodes: PodNode[],
  width: number,
  height: number
): void {
  // 1. Background fill
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // 2. Compute clusters from visible nodes
  const clusters = computeClusters(nodes);

  // 3. Draw cluster boundaries (behind pods)
  for (const cluster of clusters) {
    drawClusterBoundary(ctx, cluster);
  }

  // 4. Draw namespace labels
  for (const cluster of clusters) {
    drawNamespaceLabel(ctx, cluster);
  }

  // 5. Draw pods (sorted by animProgress so newly-animating pods draw on top)
  const visibleNodes = nodes.filter(n => n.animProgress > 0);
  visibleNodes.sort((a, b) => a.animProgress - b.animProgress);
  for (const node of visibleNodes) {
    drawPod(ctx, node);
  }
}

/** Compute the total number of visible pods and unique namespaces. Used for stats overlay. */
export function computeStats(nodes: PodNode[]): { podCount: number; nsCount: number } {
  let podCount = 0;
  const namespaces = new Set<string>();
  for (const n of nodes) {
    if (n.animProgress > 0 || n.animStartTime > 0) {
      podCount++;
      namespaces.add(n.clusterId);
    }
  }
  return { podCount, nsCount: namespaces.size };
}
