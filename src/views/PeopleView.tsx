import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { PreparedNode } from '../App';
import { useResizeObserver } from '../hooks/useResponsive';
import { DOMAIN_BY_ID } from '../data/domains';
import type { UIActions, UIState } from '../hooks/useUIState';
import { buildPersonEdges, type DerivedTables, type PersonEdge } from '../lib/derive';
import { formatYear } from '../lib/timeScale';

interface PeopleViewProps {
  nodes: PreparedNode[];
  derived: DerivedTables;
  ui: UIState & UIActions;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  importance: number;
  r: number;
  domain: string;
  color: string;
  events: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

export function PeopleView({ nodes, derived, ui }: PeopleViewProps) {
  const [hostRef, size] = useResizeObserver<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tick, setTick] = useState(0);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const width = Math.max(200, size.width || 1200);
  const height = Math.max(200, size.height || 720);

  /* ----- Build sim data from derived.people ----- */
  const { simNodes, simLinks } = useMemo(() => {
    // Inclusion rule: appear in 2+ events, OR have a single event of
    // importance >= 4. Keeps the graph readable while preserving lineages.
    const nameSet = new Set<string>();
    const simNodes: SimNode[] = [];
    for (const p of derived.people.values()) {
      const events = p.events
        .map((id) => nodes.find((n) => n.raw.id === id))
        .filter((n): n is PreparedNode => !!n)
        .filter(
          (n) =>
            ui.visibleDomains.has(n.raw.domain) &&
            n.raw.importance >= ui.importanceMin &&
            (!ui.frontierOnly || n.raw.frontier),
        );
      if (events.length === 0) continue;
      const totalImp = events.reduce((s, n) => s + n.raw.importance, 0);
      const eligible = events.length >= 2 || totalImp >= 4;
      if (!eligible) continue;
      const r = 4 + Math.min(18, Math.sqrt(totalImp) * 2);
      simNodes.push({
        id: p.name,
        importance: totalImp,
        r,
        domain: p.primaryDomain,
        color: DOMAIN_BY_ID[p.primaryDomain].color,
        events: events.length,
      });
      nameSet.add(p.name);
    }
    const rawEdges: PersonEdge[] = buildPersonEdges(nodes.map((n) => n.raw));
    const simLinks: SimLink[] = [];
    for (const e of rawEdges) {
      if (!nameSet.has(e.source) || !nameSet.has(e.target)) continue;
      simLinks.push({ source: e.source, target: e.target, weight: e.weight });
    }
    return { simNodes, simLinks };
  }, [derived, nodes, ui.visibleDomains, ui.importanceMin, ui.frontierOnly]);

  /* ----- Force simulation ----- */
  useEffect(() => {
    simNodesRef.current = simNodes.map((n) => ({ ...n }));
    simLinksRef.current = simLinks.map((l) => ({ ...l }));
    const sim = d3
      .forceSimulation<SimNode, SimLink>(simNodesRef.current)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinksRef.current)
          .id((d) => d.id)
          .distance((l) => 60 + 40 / (l.weight ?? 1))
          .strength(0.4),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-90))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) => d.r + 4).strength(0.9),
      )
      .alpha(1)
      .alphaDecay(0.04)
      .on('tick', () => setTick((t) => t + 1));
    simulationRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [simNodes, simLinks, width, height]);

  /* ----- Zoom ----- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = d3.select(svg);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 6])
      .on('zoom', (event) => setTransform(event.transform));
    sel.call(zoom);
    sel.on('dblclick.zoom', null);
    return () => {
      sel.on('.zoom', null);
    };
  }, []);

  const handleClick = useCallback(
    (name: string) => {
      ui.selectPerson(name === ui.selectedPerson ? null : name);
    },
    [ui],
  );

  // Reference tick to ensure re-render on simulation step
  void tick;

  const selectedPerson = ui.selectedPerson;
  const visibleEventIds = useMemo(() => {
    if (!selectedPerson) return null;
    const rec = derived.people.get(selectedPerson);
    return rec ? new Set(rec.events) : null;
  }, [selectedPerson, derived]);
  void visibleEventIds;

  return (
    <div ref={hostRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
        onClick={() => ui.selectPerson(null)}
      >
        <defs>
          <pattern id="people-grain" patternUnits="userSpaceOnUse" width="80" height="80">
            <rect width="80" height="80" fill="#FAF7F2" />
            <circle cx="20" cy="30" r="0.5" fill="rgba(120,100,80,0.05)" />
            <circle cx="60" cy="50" r="0.5" fill="rgba(120,100,80,0.04)" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#people-grain)" />

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Links */}
          {simLinksRef.current.map((l, i) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            if (!s || !t || s.x === undefined || t.x === undefined) return null;
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="rgba(120,100,80,0.35)"
                strokeWidth={Math.min(2.5, 0.6 + l.weight * 0.4)}
              />
            );
          })}
          {/* Nodes */}
          {simNodesRef.current.map((n) => {
            if (n.x === undefined || n.y === undefined) return null;
            const isSelected = selectedPerson === n.id;
            const isSearch =
              ui.search.trim() && n.id.toLowerCase().includes(ui.search.trim().toLowerCase());
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(n.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle r={n.r + 5} fill="none" stroke="#FAF7F2" strokeWidth={2.5} />
                )}
                <circle
                  r={n.r}
                  fill={n.color}
                  stroke={isSelected ? '#2c2519' : isSearch ? '#7a2e3a' : 'rgba(44,37,25,0.4)'}
                  strokeWidth={isSelected ? 2.2 : isSearch ? 1.8 : 0.8}
                  opacity={selectedPerson && !isSelected ? 0.35 : 1}
                />
                <text
                  className="node-label"
                  textAnchor="middle"
                  dy={n.r + 12}
                  style={{ fontSize: Math.max(9, Math.min(13, n.r * 0.9)) }}
                  opacity={selectedPerson && !isSelected ? 0.4 : 1}
                >
                  {n.id}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-parchment-300 bg-parchment-50/85 px-3 py-1.5 shadow-page">
        <div className="font-serif text-xs uppercase tracking-wider text-ink-500">
          People-graph
        </div>
        <div className="font-serif text-[11px] text-ink-400">
          {simNodesRef.current.length} figures · {simLinksRef.current.length} co-event ties
        </div>
      </div>

      {selectedPerson && (
        <PersonSummary
          name={selectedPerson}
          derived={derived}
          nodes={nodes}
          ui={ui}
        />
      )}
    </div>
  );
}

function PersonSummary({
  name,
  derived,
  nodes,
  ui,
}: {
  name: string;
  derived: DerivedTables;
  nodes: PreparedNode[];
  ui: UIState & UIActions;
}) {
  const p = derived.people.get(name);
  if (!p) return null;
  const events = p.events
    .map((id) => nodes.find((n) => n.raw.id === id))
    .filter((n): n is PreparedNode => !!n)
    .sort((a, b) => a.year - b.year);
  return (
    <div className="absolute left-3 top-3 w-80 rounded-md border border-parchment-300 bg-parchment-50/95 px-4 py-3 shadow-card">
      <div className="font-serif text-lg text-ink-900">{name}</div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500">
        {events.length} events · {formatYear(p.dateMin)} – {formatYear(p.dateMax)}
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto pr-1 text-[13px]">
        {events.map((n) => {
          const d = DOMAIN_BY_ID[n.raw.domain];
          return (
            <li key={n.raw.id} className="mb-1">
              <button
                type="button"
                onClick={() => ui.teleportTo(n.raw.id)}
                className="text-left font-serif text-ink-700 hover:text-ink-900"
              >
                <span className="inline-block h-2 w-2 align-middle" style={{ background: d.color }} />
                <span className="ml-2">{n.raw.label}</span>
                <span className="ml-2 font-sans text-[10px] text-ink-500">
                  {formatYear(n.year)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
