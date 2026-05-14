import { useMemo, useState } from 'react';
import type { PreparedEdge, PreparedNode } from '../App';
import { DOMAIN_BY_ID } from '../data/domains';
import { formatYear, parseEventYear } from '../lib/timeScale';
import type { UIActions, UIState } from '../hooks/useUIState';
import type { DerivedTables } from '../lib/derive';
import type { EdgeType } from '../types';

interface DetailPanelProps {
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  derived: DerivedTables;
  ui: UIState & UIActions;
}

export function DetailPanel({ nodes, edges, derived, ui }: DetailPanelProps) {
  const sel = ui.selectedId;
  const [a, b] = ui.compareIds;
  const showCompare = !!(a && b && a !== b);
  const [collapsed, setCollapsed] = useState(false);

  const node = useMemo(() => nodes.find((n) => n.raw.id === sel) ?? null, [nodes, sel]);

  if (collapsed && (sel || showCompare)) {
    return (
      <aside className="group/detail relative hidden h-full w-10 shrink-0 flex-col items-center border-l border-parchment-300 bg-parchment-50/70 py-3 transition-[width] duration-200 ease-out hover:w-14 hover:bg-parchment-50 lg:flex">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-ink-500 hover:bg-parchment-200/70 hover:text-ink-700"
          aria-label="Expand detail panel"
          title="Expand"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3 L5 7 L9 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="mt-6 origin-top-left rotate-90 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {showCompare ? 'compare' : 'detail'}
        </div>
      </aside>
    );
  }

  if (!sel || !node) {
    return (
      <aside
        aria-hidden
        className="hidden h-full w-[26rem] shrink-0 border-l border-parchment-300 bg-parchment-50/40 px-6 py-8 text-ink-500 lg:block"
      >
        <div className="font-serif text-lg italic">Pick an event to read its entry.</div>
        <ul className="mt-4 list-disc space-y-1 pl-5 font-serif text-sm leading-relaxed">
          <li>Click a node for its full entry.</li>
          <li>
            <span className="text-ink-700">Shift-click</span> two nodes to trace the shortest
            influence path between them.
          </li>
          <li>
            Press <kbd className="rounded border border-parchment-300 bg-parchment-100 px-1 font-sans text-xs">I</kbd>{' '}
            to glow ancestors blue and descendants amber.
          </li>
          <li>
            Search and press <kbd className="rounded border border-parchment-300 bg-parchment-100 px-1 font-sans text-xs">↵</kbd>{' '}
            to teleport.
          </li>
        </ul>
      </aside>
    );
  }

  if (showCompare) {
    return <CompareNarrative nodes={nodes} edges={edges} aId={a!} bId={b!} ui={ui} />;
  }

  const ev = node.raw;
  const d = DOMAIN_BY_ID[ev.domain];
  const year = parseEventYear(ev.date);
  const dateStr =
    typeof ev.date === 'string' && /\d{4}-\d{2}-\d{2}/.test(ev.date)
      ? formatPreciseDate(ev.date)
      : formatYear(year);
  const uncertainty = ev.dateUncertainty ?? 0;
  const inLinks = edges.filter((e) => e.target === ev.id);
  const outLinks = edges.filter((e) => e.source === ev.id || e.secondarySource === ev.id);
  const nodeById = (id: string) => nodes.find((n) => n.raw.id === id);

  const locations = ev.locations ?? [];
  const concepts = ev.concepts ?? [];

  return (
    <aside className="group/detail relative flex h-full w-[28rem] shrink-0 flex-col border-l border-parchment-300 bg-parchment-50 shadow-card transition-[width] duration-200 ease-out hover:w-[30rem]">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <div
            className="text-[11px] font-medium uppercase tracking-[0.16em]"
            style={{ color: d.color }}
          >
            {d.label}
            {ev.subdomain && (
              <span className="ml-2 text-ink-500/80">/ {ev.subdomain.replace(/_/g, ' ')}</span>
            )}
          </div>
          <h2 className="mt-1 font-serif text-2xl leading-snug text-ink-900">{ev.label}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-sans text-sm text-ink-500">
            <span className="font-serif italic">{dateStr}</span>
            {uncertainty > 0 && (
              <span className="text-xs text-ink-400">± {formatUncertainty(uncertainty)}</span>
            )}
            {ev.frontier && (
              <span className="rounded-sm border border-domain-medicine/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-domain-medicine">
                Active — ongoing
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
            aria-label="Collapse detail panel"
            title="Collapse"
          >
            collapse
          </button>
          <button
            type="button"
            onClick={ui.togglePinDetail}
            className={`rounded-md border px-2 py-1 font-sans text-xs ${
              ui.detailPinned
                ? 'border-ink-700 bg-ink-700 text-parchment-50'
                : 'border-parchment-300 bg-parchment-50 text-ink-600 hover:bg-parchment-200'
            }`}
            aria-pressed={ui.detailPinned}
            title="Pin this panel open"
          >
            {ui.detailPinned ? 'pinned' : 'pin'}
          </button>
          <button
            type="button"
            onClick={ui.closeDetail}
            className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
            aria-label="Close detail panel"
          >
            close
          </button>
        </div>
      </div>

      <div className="scroll-soft mt-3 flex-1 overflow-y-auto px-6 pb-6">
        <p className="drop-cap font-serif text-[15px] leading-relaxed text-ink-700">
          {ev.description}
        </p>

        {ev.keyFigures && ev.keyFigures.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Key figures</div>
            <div className="mt-1 flex flex-wrap gap-1.5 font-serif text-[14px] text-ink-800">
              {ev.keyFigures.map((name) => {
                const inGraph = derived.people.has(name);
                return (
                  <button
                    key={name}
                    onClick={() => {
                      if (inGraph) {
                        ui.selectPerson(name);
                        ui.setView('people');
                      }
                    }}
                    className="rounded border border-parchment-300 bg-parchment-50 px-2 py-0.5 hover:bg-parchment-200/70"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {locations.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Locations</div>
            <ul className="mt-1 space-y-0.5">
              {locations.map((loc, i) => (
                <li key={i}>
                  <button
                    onClick={() => ui.setView('geo')}
                    className="text-left font-serif text-[14px] text-ink-800 hover:underline"
                  >
                    {loc.label}
                    <span className="ml-2 font-sans text-[10px] text-ink-400">
                      {loc.lat.toFixed(1)}°, {loc.lon.toFixed(1)}°
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {concepts.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Concepts</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {concepts.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    ui.selectConcept(c);
                    ui.setView('concept');
                  }}
                  className="rounded-full border border-parchment-300 bg-parchment-50 px-2 py-0.5 font-serif text-[12px] text-ink-700 hover:bg-parchment-200/70"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={ui.toggleTrace}
            className={`rounded-md border px-3 py-1 font-sans text-xs ${
              ui.traceActive
                ? 'border-ink-700 bg-ink-700 text-parchment-50'
                : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-200'
            }`}
            aria-pressed={ui.traceActive}
          >
            {ui.traceActive ? 'Tracing influence chain' : 'Trace influence chain'}
          </button>
          {ui.traceActive && (
            <div className="flex items-center gap-1 text-xs text-ink-600">
              <span>depth:</span>
              {([1, 2, -1] as const).map((depthV) => (
                <button
                  key={depthV}
                  type="button"
                  onClick={() => ui.setTraceDepth(depthV)}
                  className={`rounded border px-2 py-0.5 font-sans ${
                    ui.traceDepth === depthV
                      ? 'border-ink-600 bg-ink-100 text-ink-800'
                      : 'border-parchment-300 bg-parchment-50 text-ink-600 hover:bg-parchment-200'
                  }`}
                >
                  {depthV === -1 ? 'all' : `${depthV} hop${depthV > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <RelatedSection
          title="Built on"
          items={inLinks
            .map((e) => ({ edge: e, other: nodeById(e.source) }))
            .filter((x): x is { edge: PreparedEdge; other: PreparedNode } => !!x.other)}
          onSelect={(id) => ui.selectNode(id)}
        />
        <RelatedSection
          title="Enabled"
          items={outLinks
            .map((e) => ({ edge: e, other: nodeById(e.target) }))
            .filter((x): x is { edge: PreparedEdge; other: PreparedNode } => !!x.other)}
          onSelect={(id) => ui.selectNode(id)}
        />

        <p className="mt-8 border-t border-parchment-300 pt-4 font-serif text-[11px] italic text-ink-400">
          Importance {ev.importance}/5 · click any related event to follow its thread.
        </p>
      </div>
    </aside>
  );
}

interface RelatedItem {
  edge: PreparedEdge;
  other: PreparedNode;
}

interface RelatedSectionProps {
  title: string;
  items: RelatedItem[];
  onSelect: (id: string) => void;
}

function RelatedSection({ title, items, onSelect }: RelatedSectionProps) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.other.year - b.other.year);
  return (
    <div className="mt-5 border-t border-parchment-300/80 pt-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{title}</div>
        <div className="font-sans text-[10px] text-ink-400">{items.length}</div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {sorted.map(({ edge, other }) => {
          const d = DOMAIN_BY_ID[other.raw.domain];
          return (
            <li key={other.raw.id + '_' + edge.type}>
              <button
                type="button"
                onClick={() => onSelect(other.raw.id)}
                className="group flex w-full items-start gap-2 rounded-sm px-1 py-1 text-left hover:bg-parchment-200/70"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="flex-1">
                  <span className="font-serif text-[14px] text-ink-800 group-hover:text-ink-900">
                    {other.raw.label}
                  </span>
                  <span className="ml-2 font-sans text-[11px] text-ink-400">
                    {formatYear(other.year)}
                  </span>
                  <span className="ml-2 inline-block text-[10px] uppercase tracking-wider text-ink-500">
                    {edgeLabel(edge.type)}
                  </span>
                  {edge.description && (
                    <span className="block font-serif text-[12.5px] italic leading-snug text-ink-500">
                      {edge.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function edgeLabel(t: EdgeType): string {
  switch (t) {
    case 'enables':
      return 'enables';
    case 'influences':
      return 'influences';
    case 'refines':
      return 'refines';
    case 'synthesizes':
      return 'synthesizes';
    case 'parallel':
      return 'parallel discovery';
  }
}

function formatUncertainty(years: number): string {
  if (years >= 1000) return `${Math.round(years / 1000).toLocaleString()} ky`;
  if (years >= 1) return `${years} yr`;
  return `${Math.round(years * 12)} mo`;
}

function formatPreciseDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const yy = Number(y);
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mn = months[Number(m)] ?? '';
  return `${d ? Number(d) + ' ' : ''}${mn} ${yy}`;
}

interface CompareProps {
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  aId: string;
  bId: string;
  ui: UIState & UIActions;
}

function CompareNarrative({ nodes, edges, aId, bId, ui }: CompareProps) {
  const path = useMemo(() => {
    const adj = new Map<string, { other: string; type: EdgeType; desc?: string }[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push({ other: e.target, type: e.type, desc: e.description });
      adj.get(e.target)!.push({ other: e.source, type: e.type, desc: e.description });
    }
    const prev = new Map<string, string | null>();
    prev.set(aId, null);
    const q: string[] = [aId];
    while (q.length) {
      const cur = q.shift()!;
      if (cur === bId) break;
      const nbrs = adj.get(cur) ?? [];
      for (const n of nbrs) {
        if (prev.has(n.other)) continue;
        prev.set(n.other, cur);
        q.push(n.other);
      }
    }
    if (!prev.has(bId)) return null;
    const path: string[] = [];
    let cur: string | null = bId;
    while (cur) {
      path.unshift(cur);
      cur = prev.get(cur) ?? null;
    }
    return path;
  }, [edges, aId, bId]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.raw.id, n])), [nodes]);

  return (
    <aside className="group/detail relative flex h-full w-[28rem] shrink-0 flex-col border-l border-parchment-300 bg-parchment-50 shadow-card transition-[width] duration-200 ease-out hover:w-[30rem]">
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-domain-medicine">
            Compare path
          </div>
          <h2 className="mt-1 font-serif text-xl leading-snug text-ink-900">
            From {nodeMap.get(aId)?.raw.label} to {nodeMap.get(bId)?.raw.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            ui.clearCompare();
            ui.selectNode(aId);
          }}
          className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
        >
          close
        </button>
      </div>

      <div className="scroll-soft mt-4 flex-1 overflow-y-auto px-6 pb-6">
        {!path ? (
          <p className="font-serif italic text-ink-500">
            No influence path connects these two events in the current graph.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-parchment-300 pl-5">
            {path.map((id, i) => {
              const n = nodeMap.get(id);
              if (!n) return null;
              const d = DOMAIN_BY_ID[n.raw.domain];
              return (
                <li key={id} className="relative">
                  <span
                    className="absolute -left-[26px] top-2 h-3 w-3 rounded-full border-2 border-parchment-50"
                    style={{ background: d.color }}
                  />
                  <button
                    type="button"
                    onClick={() => ui.selectNode(id)}
                    className="w-full rounded-md border border-parchment-300/60 bg-parchment-50 px-3 py-2 text-left hover:bg-parchment-200/60"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-serif text-[15px] text-ink-900">
                        {i + 1}. {n.raw.label}
                      </div>
                      <div className="font-sans text-[11px] text-ink-500">
                        {formatYear(n.year)}
                      </div>
                    </div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: d.color }}>
                      {d.label}
                    </div>
                    <p className="mt-1 line-clamp-2 font-serif text-[13px] leading-snug text-ink-600">
                      {n.raw.description}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-6 border-t border-parchment-300 pt-3 font-serif text-[11px] italic text-ink-400">
          Shortest path treats influence as an undirected relation. Click any step to read its
          entry.
        </p>
      </div>
    </aside>
  );
}
