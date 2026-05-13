import { useEffect, useState } from 'react';

export interface ConceptNode {
  id: string;
  parent: string | null;
  label: string;
}

export interface ConceptTreeNode {
  id: string;
  label: string;
  children: ConceptTreeNode[];
  depth: number;
}

export type ConceptHierarchyState =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'ready'; nodes: ConceptNode[]; childrenByParent: Map<string | null, ConceptNode[]>; nodeById: Map<string, ConceptNode> };

/**
 * Loads the optional concepts.json hierarchy. If the file isn't present the
 * concept view falls back to grouping by dominant domain.
 */
export function useConceptHierarchy(
  url: string = import.meta.env.BASE_URL + 'concepts.json',
): ConceptHierarchyState {
  const [state, setState] = useState<ConceptHierarchyState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((doc: { concepts?: ConceptNode[] }) => {
        if (!alive) return;
        const nodes = doc.concepts ?? [];
        if (nodes.length === 0) {
          setState({ status: 'absent' });
          return;
        }
        const childrenByParent = new Map<string | null, ConceptNode[]>();
        const nodeById = new Map<string, ConceptNode>();
        for (const n of nodes) {
          nodeById.set(n.id, n);
          const k = n.parent;
          if (!childrenByParent.has(k)) childrenByParent.set(k, []);
          childrenByParent.get(k)!.push(n);
        }
        for (const list of childrenByParent.values()) {
          list.sort((a, b) => a.label.localeCompare(b.label));
        }
        setState({ status: 'ready', nodes, childrenByParent, nodeById });
      })
      .catch(() => {
        if (!alive) return;
        setState({ status: 'absent' });
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return state;
}
