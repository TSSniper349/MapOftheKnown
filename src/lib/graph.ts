import type { EdgeLink, EventNode } from '../types';

export interface GraphIndex {
  nodes: Map<string, EventNode>;
  outgoing: Map<string, EdgeLink[]>;
  incoming: Map<string, EdgeLink[]>;
}

export function buildIndex(nodes: EventNode[], edges: EdgeLink[]): GraphIndex {
  const nodeMap = new Map<string, EventNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  const outgoing = new Map<string, EdgeLink[]>();
  const incoming = new Map<string, EdgeLink[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source.id)) outgoing.set(e.source.id, []);
    outgoing.get(e.source.id)!.push(e);
    if (!incoming.has(e.target.id)) incoming.set(e.target.id, []);
    incoming.get(e.target.id)!.push(e);
  }
  return { nodes: nodeMap, outgoing, incoming };
}

/** Set of node ids reachable from `rootId` following outgoing edges up to `maxHops`. */
export function descendants(idx: GraphIndex, rootId: string, maxHops = Infinity): Set<string> {
  return bfs(idx.outgoing, rootId, maxHops);
}

/** Set of node ids that can reach `rootId` via outgoing edges, up to `maxHops`. */
export function ancestors(idx: GraphIndex, rootId: string, maxHops = Infinity): Set<string> {
  return bfs(idx.incoming, rootId, maxHops);
}

function bfs(adj: Map<string, EdgeLink[]>, start: string, maxHops: number): Set<string> {
  const seen = new Set<string>([start]);
  let frontier: string[] = [start];
  let hops = 0;
  while (frontier.length && hops < maxHops) {
    const next: string[] = [];
    for (const id of frontier) {
      const edges = adj.get(id);
      if (!edges) continue;
      for (const e of edges) {
        const other = e.source.id === id ? e.target.id : e.source.id;
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
    hops += 1;
  }
  return seen;
}

/** Shortest path between two nodes, treating edges as undirected. Returns array of node ids or null. */
export function shortestPath(
  idx: GraphIndex,
  fromId: string,
  toId: string,
): { path: string[]; edges: EdgeLink[] } | null {
  if (fromId === toId) return { path: [fromId], edges: [] };
  const prev = new Map<string, { from: string; edge: EdgeLink } | null>();
  prev.set(fromId, null);
  const queue: string[] = [fromId];
  while (queue.length) {
    const id = queue.shift()!;
    const neighbors = [...(idx.outgoing.get(id) ?? []), ...(idx.incoming.get(id) ?? [])];
    for (const e of neighbors) {
      const other = e.source.id === id ? e.target.id : e.source.id;
      if (prev.has(other)) continue;
      prev.set(other, { from: id, edge: e });
      if (other === toId) {
        const path: string[] = [];
        const edges: EdgeLink[] = [];
        let cur: string | null = toId;
        while (cur && cur !== fromId) {
          path.unshift(cur);
          const step: { from: string; edge: EdgeLink } | null | undefined = prev.get(cur);
          if (!step) break;
          edges.unshift(step.edge);
          cur = step.from;
        }
        path.unshift(fromId);
        return { path, edges };
      }
      queue.push(other);
    }
  }
  return null;
}
