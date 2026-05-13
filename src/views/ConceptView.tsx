import { useMemo, useState } from 'react';
import type { PreparedNode } from '../App';
import { DOMAIN_BY_ID, DOMAINS } from '../data/domains';
import { formatYear } from '../lib/timeScale';
import type { UIActions, UIState } from '../hooks/useUIState';
import type { DerivedTables } from '../lib/derive';
import type { ConceptRecord, DomainId } from '../types';
import { useConceptHierarchy, type ConceptNode } from '../hooks/useConceptHierarchy';

interface ConceptViewProps {
  nodes: PreparedNode[];
  derived: DerivedTables;
  ui: UIState & UIActions;
}

export function ConceptView({ nodes, derived, ui }: ConceptViewProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'tree' | 'flat'>('tree');
  const hierarchy = useConceptHierarchy();

  /* Group concepts by their dominant domain (the flat-mode fallback). */
  const grouped = useMemo(() => {
    const groups = new Map<DomainId, ConceptRecord[]>();
    for (const d of DOMAINS) groups.set(d.id, []);
    for (const c of derived.concepts.values()) {
      let primary: DomainId = DOMAINS[0].id;
      let bestN = -1;
      for (const [d, n] of c.domains) {
        if (n > bestN) {
          primary = d;
          bestN = n;
        }
      }
      groups.get(primary)!.push(c);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => b.events.length - a.events.length || a.id.localeCompare(b.id));
    }
    return groups;
  }, [derived]);

  const filteredQuery = query.trim().toLowerCase();
  const totalConcepts = derived.concepts.size;

  const selectedConcept = ui.selectedConcept
    ? derived.concepts.get(ui.selectedConcept) ?? null
    : null;
  const selectedEvents = useMemo(() => {
    if (!selectedConcept) return [];
    return selectedConcept.events
      .map((id) => nodes.find((n) => n.raw.id === id))
      .filter((x): x is PreparedNode => !!x)
      .sort((a, b) => a.year - b.year);
  }, [selectedConcept, nodes]);

  const hierarchyReady = hierarchy.status === 'ready';
  const effectiveMode = hierarchyReady ? mode : 'flat';

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-parchment-100">
      <div className="border-b border-parchment-300 bg-parchment-50/95 px-6 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-ink-900">Concepts</h2>
            <p className="font-serif text-xs italic text-ink-500">
              {totalConcepts.toLocaleString()} concept tags
              {hierarchyReady
                ? ` · ${hierarchy.nodes.length} in hierarchy`
                : ' · no hierarchy (add public/concepts.json for a tree)'}
              . Click a tag to highlight its events across views.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hierarchyReady && (
              <div className="flex rounded-md border border-parchment-300 bg-parchment-50 text-[11px] font-sans">
                {(['tree', 'flat'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-1 ${
                      mode === m ? 'bg-ink-700 text-parchment-50' : 'text-ink-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter concepts…"
              type="search"
              className="w-56 rounded-md border border-parchment-300 bg-parchment-50 px-3 py-1.5 font-serif text-sm text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4 scroll-soft">
          {effectiveMode === 'tree' && hierarchyReady ? (
            <ConceptTree
              hierarchy={hierarchy}
              concepts={derived.concepts}
              query={filteredQuery}
              ui={ui}
            />
          ) : (
            <FlatConcepts
              grouped={grouped}
              filteredQuery={filteredQuery}
              ui={ui}
            />
          )}
          {totalConcepts === 0 && (
            <div className="mt-8 text-center font-serif italic text-ink-500">
              No concepts found. Events need `concepts: ["…"]` tags to appear here.
            </div>
          )}
        </div>

        {selectedConcept && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-parchment-300 bg-parchment-50 px-5 py-4 scroll-soft">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg text-ink-900">{selectedConcept.id}</h3>
              <button
                onClick={() => ui.selectConcept(null)}
                className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-0.5 font-sans text-xs text-ink-600 hover:bg-parchment-200"
                aria-label="Clear concept selection"
              >
                clear
              </button>
            </div>
            <div className="font-serif text-[11px] uppercase tracking-wider text-ink-500">
              {selectedConcept.events.length} events ·{' '}
              {formatYear(selectedConcept.dateMin)} – {formatYear(selectedConcept.dateMax)}
              {hierarchyReady && (
                <AncestryBreadcrumb id={selectedConcept.id} hierarchy={hierarchy} />
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {selectedEvents.map((n) => {
                const d = DOMAIN_BY_ID[n.raw.domain];
                return (
                  <li key={n.raw.id}>
                    <button
                      type="button"
                      onClick={() => ui.teleportTo(n.raw.id)}
                      className="group flex w-full items-start gap-2 rounded-sm px-1 py-1 text-left hover:bg-parchment-200/70"
                    >
                      <span
                        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: d.color }}
                      />
                      <span className="flex-1">
                        <span className="font-serif text-[14px] text-ink-800 group-hover:text-ink-900">
                          {n.raw.label}
                        </span>
                        <span className="ml-2 font-sans text-[11px] text-ink-400">
                          {formatYear(n.year)}
                        </span>
                        <span
                          className="block text-[10px] uppercase tracking-wider"
                          style={{ color: d.color }}
                        >
                          {d.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ----- Tree mode ----- */

interface ConceptTreeProps {
  hierarchy: Extract<ReturnType<typeof useConceptHierarchy>, { status: 'ready' }>;
  concepts: Map<string, ConceptRecord>;
  query: string;
  ui: UIState & UIActions;
}

function ConceptTree({ hierarchy, concepts, query, ui }: ConceptTreeProps) {
  const { childrenByParent, nodeById } = hierarchy;
  const orphanIds = useMemo(() => {
    const inHierarchy = new Set(nodeById.keys());
    return [...concepts.keys()].filter((c) => !inHierarchy.has(c));
  }, [concepts, nodeById]);

  return (
    <div>
      {(childrenByParent.get(null) ?? []).map((root) => (
        <TreeBranch
          key={root.id}
          node={root}
          childrenByParent={childrenByParent}
          concepts={concepts}
          query={query}
          ui={ui}
          depth={0}
        />
      ))}
      {orphanIds.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 font-serif text-[14px] uppercase tracking-[0.16em] text-ink-500">
            Unclassified
            <span className="ml-2 font-sans text-[10px] text-ink-400">{orphanIds.length}</span>
          </h3>
          <ChipsRow
            ids={orphanIds.filter((id) => !query || id.includes(query))}
            concepts={concepts}
            ui={ui}
          />
        </section>
      )}
    </div>
  );
}

interface TreeBranchProps {
  node: ConceptNode;
  childrenByParent: Map<string | null, ConceptNode[]>;
  concepts: Map<string, ConceptRecord>;
  query: string;
  ui: UIState & UIActions;
  depth: number;
}

function TreeBranch({
  node,
  childrenByParent,
  concepts,
  query,
  ui,
  depth,
}: TreeBranchProps) {
  const children = childrenByParent.get(node.id) ?? [];
  const ownRecord = concepts.get(node.id);
  const matches = matchesQuery(node, query) || (ownRecord && node.id.includes(query));
  // Show this branch if it or any descendant matches the filter
  const visibleChildren = children
    .map((c) => ({
      node: c,
      visible: branchHasMatch(c, childrenByParent, query) || !query,
    }))
    .filter((x) => x.visible);
  if (query && !matches && visibleChildren.length === 0) return null;

  const isRoot = depth === 0;
  const headerSize = isRoot ? 'text-[15px]' : depth === 1 ? 'text-[14px]' : 'text-[13px]';
  const isSel = ui.selectedConcept === node.id;

  return (
    <section className={`${isRoot ? 'mb-5' : 'mb-2'} pl-${Math.min(depth, 6)}`} style={{ paddingLeft: depth * 12 }}>
      <div className="flex items-baseline gap-2">
        {ownRecord ? (
          <button
            onClick={() => ui.selectConcept(isSel ? null : node.id)}
            className={`font-serif uppercase tracking-[0.14em] ${headerSize} ${
              isSel ? 'text-domain-medicine' : 'text-ink-700 hover:text-ink-900'
            }`}
          >
            {node.label}
          </button>
        ) : (
          <span
            className={`font-serif uppercase tracking-[0.14em] ${headerSize} text-ink-500`}
          >
            {node.label}
          </span>
        )}
        {ownRecord && (
          <span className="font-sans text-[10px] text-ink-400">{ownRecord.events.length}</span>
        )}
        {ownRecord?.frontier && (
          <span className="rounded-sm border border-domain-medicine/40 px-1 text-[9px] uppercase tracking-wider text-domain-medicine">
            frontier
          </span>
        )}
      </div>
      {visibleChildren.map(({ node: child }) => (
        <TreeBranch
          key={child.id}
          node={child}
          childrenByParent={childrenByParent}
          concepts={concepts}
          query={query}
          ui={ui}
          depth={depth + 1}
        />
      ))}
    </section>
  );
}

function matchesQuery(node: ConceptNode, q: string): boolean {
  if (!q) return true;
  return node.id.includes(q) || node.label.toLowerCase().includes(q);
}

function branchHasMatch(
  node: ConceptNode,
  childrenByParent: Map<string | null, ConceptNode[]>,
  q: string,
): boolean {
  if (!q) return true;
  if (matchesQuery(node, q)) return true;
  const children = childrenByParent.get(node.id) ?? [];
  return children.some((c) => branchHasMatch(c, childrenByParent, q));
}

function AncestryBreadcrumb({
  id,
  hierarchy,
}: {
  id: string;
  hierarchy: Extract<ReturnType<typeof useConceptHierarchy>, { status: 'ready' }>;
}) {
  const path: string[] = [];
  let cur: string | null = id;
  while (cur) {
    const n = hierarchy.nodeById.get(cur);
    if (!n) break;
    path.unshift(n.label);
    cur = n.parent;
  }
  if (path.length <= 1) return null;
  return (
    <div className="mt-1 font-serif text-[10px] italic text-ink-400">
      {path.join(' / ')}
    </div>
  );
}

/* ----- Flat mode ----- */

interface FlatConceptsProps {
  grouped: Map<DomainId, ConceptRecord[]>;
  filteredQuery: string;
  ui: UIState & UIActions;
}

function FlatConcepts({ grouped, filteredQuery, ui }: FlatConceptsProps) {
  return (
    <>
      {DOMAINS.map((d) => {
        const list = grouped.get(d.id) ?? [];
        const filtered = filteredQuery
          ? list.filter((c) => c.id.includes(filteredQuery))
          : list;
        if (filtered.length === 0) return null;
        return (
          <section key={d.id} className="mb-6">
            <h3
              className="mb-2 font-serif text-[15px] uppercase tracking-[0.16em]"
              style={{ color: d.color }}
            >
              {d.label}
              <span className="ml-2 font-sans text-[10px] text-ink-400">{filtered.length}</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((c) => (
                <ConceptChip key={c.id} concept={c} ui={ui} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ChipsRow({
  ids,
  concepts,
  ui,
}: {
  ids: string[];
  concepts: Map<string, ConceptRecord>;
  ui: UIState & UIActions;
}) {
  const items = ids
    .map((id) => concepts.get(id))
    .filter((c): c is ConceptRecord => !!c)
    .sort((a, b) => b.events.length - a.events.length);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <ConceptChip key={c.id} concept={c} ui={ui} />
      ))}
    </div>
  );
}

function ConceptChip({ concept, ui }: { concept: ConceptRecord; ui: UIState & UIActions }) {
  const isSel = ui.selectedConcept === concept.id;
  return (
    <button
      onClick={() => ui.selectConcept(isSel ? null : concept.id)}
      className={`rounded-full border px-2.5 py-0.5 font-serif text-[13px] transition-colors ${
        isSel
          ? 'border-ink-700 bg-ink-700 text-parchment-50'
          : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-200/70'
      } ${concept.frontier ? 'ring-1 ring-domain-medicine/40' : ''}`}
    >
      {concept.id}
      <span className={`ml-1.5 text-[10px] ${isSel ? 'text-parchment-200' : 'text-ink-400'}`}>
        {concept.events.length}
      </span>
    </button>
  );
}
