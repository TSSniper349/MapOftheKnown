import type { EventNode } from '../types';

/** Map an importance 1..5 to a node radius. */
export function radiusFor(importance: number): number {
  return 3 + (Math.max(1, Math.min(5, importance)) - 1) * 1.6;
}

/**
 * Resolve vertical overlap within a horizontal lane: nodes whose x positions are within
 * `proximityPx` of each other get jittered along y inside the lane band so labels and
 * circles stay legible.
 *
 * Mutates each node's `y` (and assumes `x` and `radius` are already set).
 */
export function resolveLaneJitter(
  nodes: EventNode[],
  laneCenterY: number,
  laneHalfHeight: number,
  proximityPx = 22,
): void {
  if (nodes.length === 0) return;
  const sorted = [...nodes].sort((a, b) => a.x - b.x);
  let cluster: EventNode[] = [];
  const flushCluster = () => {
    if (cluster.length <= 1) {
      if (cluster.length === 1) cluster[0].y = laneCenterY;
      cluster = [];
      return;
    }
    const count = cluster.length;
    const padding = Math.min(laneHalfHeight - 4, 9);
    const span = Math.min(laneHalfHeight - 4, padding * (count - 1));
    cluster.forEach((n, i) => {
      const t = count === 1 ? 0 : i / (count - 1);
      const offset = -span / 2 + t * span;
      const phase = (i % 2 === 0 ? 1 : -1) * (0.6 + (i % 3) * 0.15);
      n.y = laneCenterY + offset * 0.6 + phase * 1.6;
    });
    cluster = [];
  };
  for (const n of sorted) {
    if (cluster.length === 0) {
      cluster.push(n);
      continue;
    }
    const prev = cluster[cluster.length - 1];
    if (Math.abs(n.x - prev.x) <= proximityPx) {
      cluster.push(n);
    } else {
      flushCluster();
      cluster.push(n);
    }
  }
  flushCluster();
}
