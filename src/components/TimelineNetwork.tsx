import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { PreparedEdge, PreparedNode } from '../App';
import { useResizeObserver } from '../hooks/useResponsive';
import { createEraScale, formatYear } from '../lib/timeScale';
import { DOMAINS, DOMAIN_BY_ID, DOMAIN_INDEX } from '../data/domains';
import { resolveLaneJitter, radiusFor } from '../lib/layout';
import { buildIndex, ancestors, descendants, shortestPath } from '../lib/graph';
import type { EdgeLink, EventNode } from '../types';
import type { UIState, UIActions } from '../hooks/useUIState';
import { NodeTooltip } from './NodeTooltip';

interface TimelineNetworkProps {
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  ui: UIState & UIActions;
}

const MARGIN = { top: 38, right: 24, bottom: 34, left: 132 };

export function TimelineNetwork({ nodes: rawNodes, edges: rawEdges, ui }: TimelineNetworkProps) {
  const [hostRef, size] = useResizeObserver<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [hover, setHover] = useState<{ id: string; clientX: number; clientY: number } | null>(null);

  const innerW = Math.max(0, size.width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);

  /* ----- Compute layout in "world" coordinates ----- */
  const layout = useMemo(() => {
    if (innerW <= 0 || innerH <= 0) return null;
    const xScale = createEraScale(0, innerW);
    const laneCount = DOMAINS.length;
    const laneH = innerH / laneCount;

    const positioned: EventNode[] = rawNodes.map(({ raw, year }) => {
      const li = DOMAIN_INDEX[raw.domain];
      const cy = li * laneH + laneH / 2;
      return {
        ...raw,
        year,
        rawDate: raw.date,
        laneIndex: li,
        x: xScale.forward(year),
        y: cy,
        radius: radiusFor(raw.importance),
      };
    });

    for (let i = 0; i < laneCount; i++) {
      const laneNodes = positioned.filter((n) => n.laneIndex === i);
      const cy = i * laneH + laneH / 2;
      resolveLaneJitter(laneNodes, cy, laneH / 2 - 2);
    }

    const idToNode = new Map(positioned.map((n) => [n.id, n] as const));
    const edges: EdgeLink[] = [];
    for (const e of rawEdges) {
      const s = idToNode.get(e.source);
      const t = idToNode.get(e.target);
      if (!s || !t) continue;
      edges.push({ source: s, target: t, type: e.type, description: e.description });
    }

    const idx = buildIndex(positioned, edges);
    return { xScale, laneH, nodes: positioned, edges, idx };
  }, [rawNodes, rawEdges, innerW, innerH]);

  /* ----- d3 zoom ----- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const sel = d3.select(svg);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [-40, 0],
        [innerW + 40, 0],
      ])
      .extent([
        [0, 0],
        [innerW, 0],
      ])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
    sel.call(zoom);
    sel.on('dblclick.zoom', null);
    // Store the zoom on the svg node so we can programmatically transform it later.
    (svg as unknown as { __zoom: typeof zoom }).__zoom = zoom;
    return () => {
      sel.on('.zoom', null);
    };
  }, [innerW, innerH, layout]);

  /* ----- Apply external yearWindow → zoom transform ----- */
  useEffect(() => {
    if (!layout || !svgRef.current) return;
    const svg = svgRef.current;
    const win = ui.yearWindow;
    if (!win) return;
    const [y0, y1] = win;
    const x0 = layout.xScale.forward(y0);
    const x1 = layout.xScale.forward(y1);
    const spanPx = Math.max(8, x1 - x0);
    const k = Math.max(1, Math.min(24, innerW / spanPx));
    const tx = -x0 * k;
    const newT = d3.zoomIdentity.translate(tx, 0).scale(k);
    const sel = d3.select(svg);
    const zoom = (svg as unknown as { __zoom?: d3.ZoomBehavior<SVGSVGElement, unknown> }).__zoom;
    if (!zoom) return;
    sel.transition().duration(420).call(zoom.transform, newT);
  }, [ui.yearWindow, layout, innerW]);

  /* ----- Highlight (chain / compare) ----- */
  const highlight = useMemo(() => {
    if (!layout) return null;
    const { idx } = layout;
    const ancSet = new Set<string>();
    const descSet = new Set<string>();
    const pathSet = new Set<string>();
    const pathEdgeKeys = new Set<string>();

    const [a, b] = ui.compareIds;
    if (a && b && idx.nodes.has(a) && idx.nodes.has(b)) {
      const res = shortestPath(idx, a, b);
      if (res) {
        for (const id of res.path) pathSet.add(id);
        for (const e of res.edges) pathEdgeKeys.add(edgeKey(e.source.id, e.target.id, e.type));
      }
    } else if (ui.traceActive && ui.selectedId && idx.nodes.has(ui.selectedId)) {
      const depth = ui.traceDepth === -1 ? Infinity : ui.traceDepth;
      const anc = ancestors(idx, ui.selectedId, depth);
      const dec = descendants(idx, ui.selectedId, depth);
      anc.delete(ui.selectedId);
      dec.delete(ui.selectedId);
      anc.forEach((id) => ancSet.add(id));
      dec.forEach((id) => descSet.add(id));
    }

    return { ancSet, descSet, pathSet, pathEdgeKeys };
  }, [layout, ui.compareIds, ui.traceActive, ui.selectedId, ui.traceDepth]);

  /* ----- Visibility (domain, importance, search) ----- */
  const visibleSet = useMemo(() => {
    if (!layout) return new Set<string>();
    const q = ui.search.trim().toLowerCase();
    return new Set(
      layout.nodes
        .filter((n) => {
          if (!ui.visibleDomains.has(n.domain)) return false;
          if (n.importance < ui.importanceMin) return false;
          if (q) {
            const inLabel = n.label.toLowerCase().includes(q);
            const inDesc = n.description.toLowerCase().includes(q);
            const inFig = (n.keyFigures ?? []).some((f) => f.toLowerCase().includes(q));
            if (!(inLabel || inDesc || inFig)) return false;
          }
          return true;
        })
        .map((n) => n.id),
    );
  }, [layout, ui.visibleDomains, ui.importanceMin, ui.search]);

  /* ----- Keyboard shortcuts ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'i' || e.key === 'I') ui.toggleTrace();
      else if (e.key === 'Escape') ui.closeDetail();
      else if (e.key === 'e' || e.key === 'E') ui.setShowEdges(!ui.showEdges);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  /* ----- Handlers ----- */
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      ui.selectNode(id, e.shiftKey);
    },
    [ui],
  );
  const handleNodeEnter = useCallback(
    (e: React.MouseEvent, id: string) => {
      setHover({ id, clientX: e.clientX, clientY: e.clientY });
      ui.setHovered(id);
    },
    [ui],
  );
  const handleNodeLeave = useCallback(() => {
    setHover(null);
    ui.setHovered(null);
  }, [ui]);

  if (!layout) {
    return <div ref={hostRef} className="h-full w-full" />;
  }

  const { xScale, laneH, nodes, edges } = layout;
  const k = transform.k;
  const tx = transform.x;

  // World-X → screen-X helper (within plot area; add MARGIN.left to get full svg coord)
  const wxToSx = (wx: number) => tx + wx * k;

  const yearWindow = ui.yearWindow;
  const isHighlightMode =
    (highlight?.pathSet.size ?? 0) > 0 ||
    (highlight?.ancSet.size ?? 0) + (highlight?.descSet.size ?? 0) > 0;

  const tickYears = pickTickYears(k);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        onClick={() => ui.selectNode(null)}
        style={{ cursor: 'grab', display: 'block' }}
        role="img"
        aria-label="Time-axis network graph"
      >
        <defs>
          <marker
            id="arrow-enables"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <marker
            id="arrow-refines"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 L 4 5 z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </marker>
          <filter id="frontier-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="parchment-grain" patternUnits="userSpaceOnUse" width="120" height="120">
            <rect width="120" height="120" fill="none" />
            <circle cx="20" cy="40" r="0.6" fill="rgba(120,100,80,0.06)" />
            <circle cx="80" cy="20" r="0.5" fill="rgba(120,100,80,0.05)" />
            <circle cx="60" cy="90" r="0.6" fill="rgba(120,100,80,0.05)" />
            <circle cx="100" cy="60" r="0.5" fill="rgba(120,100,80,0.04)" />
          </pattern>
          <clipPath id="plot-clip">
            <rect x={0} y={-40} width={innerW} height={innerH + 80} />
          </clipPath>
        </defs>

        <rect width={size.width} height={size.height} fill="url(#parchment-grain)" />

        {/* Lane labels (fixed left) */}
        <g transform={`translate(${MARGIN.left - 10}, ${MARGIN.top})`}>
          {DOMAINS.map((d, i) => {
            const visible = ui.visibleDomains.has(d.id);
            return (
              <g
                key={d.id}
                transform={`translate(0, ${i * laneH + laneH / 2})`}
                onClick={(e) => {
                  e.stopPropagation();
                  ui.toggleDomain(d.id);
                }}
                style={{ cursor: 'pointer' }}
                role="button"
                aria-pressed={visible}
                aria-label={`${d.label} lane`}
              >
                <text
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="lane-label"
                  fill={visible ? d.color : '#BFAF95'}
                  style={{ fontWeight: visible ? 500 : 400 }}
                >
                  {d.short}
                </text>
                {!visible && (
                  <line
                    x1={-78}
                    x2={0}
                    y1={0}
                    y2={0}
                    stroke="#BFAF95"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Plot area (clipped) */}
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Lane bands - unclipped, no zoom */}
          <g>
            {DOMAINS.map((_, i) => (
              <rect
                key={i}
                x={0}
                y={i * laneH}
                width={innerW}
                height={laneH}
                fill={i % 2 === 0 ? 'rgba(155,140,114,0.045)' : 'rgba(212,197,164,0.08)'}
                pointerEvents="none"
              />
            ))}
            {DOMAINS.map((_, i) => (
              <line
                key={`hr-${i}`}
                x1={0}
                x2={innerW}
                y1={i * laneH}
                y2={i * laneH}
                stroke="rgba(156,136,102,0.22)"
                strokeWidth={0.6}
              />
            ))}
            <line
              x1={0}
              x2={innerW}
              y1={DOMAINS.length * laneH}
              y2={DOMAINS.length * laneH}
              stroke="rgba(156,136,102,0.22)"
              strokeWidth={0.6}
            />
          </g>

          {/* Era labels at top (within clip, but above plot) */}
          <g clipPath="url(#plot-clip)" pointerEvents="none">
            {xScale.eraBounds.map(({ era, x0, x1 }) => {
              const cxw = (x0 + x1) / 2;
              const sx = wxToSx(cxw);
              if (sx < -100 || sx > innerW + 100) return null;
              return (
                <text key={era.id} x={sx} y={-20} textAnchor="middle" className="era-label">
                  {era.label}
                </text>
              );
            })}
          </g>

          {/* Clipped content: era rules, edges, nodes */}
          <g clipPath="url(#plot-clip)">
            {/* Era boundary rules — drawn at screen coords */}
            {xScale.eraBounds.slice(0, -1).map(({ era, x1 }) => {
              const sx = wxToSx(x1);
              if (sx < -2 || sx > innerW + 2) return null;
              return (
                <line
                  key={era.id}
                  x1={sx}
                  x2={sx}
                  y1={-10}
                  y2={innerH}
                  stroke="rgba(156,136,102,0.55)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              );
            })}

            {/* Window-focus rectangles when yearWindow active */}
            {yearWindow && (
              <>
                <rect
                  x={0}
                  y={0}
                  width={Math.max(0, wxToSx(xScale.forward(yearWindow[0])))}
                  height={innerH}
                  fill="rgba(250,247,242,0.45)"
                  pointerEvents="none"
                />
                <rect
                  x={Math.max(0, wxToSx(xScale.forward(yearWindow[1])))}
                  y={0}
                  width={Math.max(
                    0,
                    innerW - Math.max(0, wxToSx(xScale.forward(yearWindow[1]))),
                  )}
                  height={innerH}
                  fill="rgba(250,247,242,0.45)"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Edges */}
            {ui.showEdges &&
              edges.map((edge) => {
                const sId = edge.source.id;
                const tId = edge.target.id;
                if (!visibleSet.has(sId) || !visibleSet.has(tId)) return null;
                const inHighlightedPath =
                  highlight?.pathEdgeKeys.has(edgeKey(sId, tId, edge.type)) ?? false;
                const inTraceChain =
                  isHighlightMode &&
                  ((highlight!.ancSet.has(sId) || sId === ui.selectedId) &&
                    (highlight!.ancSet.has(tId) || tId === ui.selectedId)) ||
                  (isHighlightMode &&
                    (highlight!.descSet.has(sId) || sId === ui.selectedId) &&
                    (highlight!.descSet.has(tId) || tId === ui.selectedId));
                const hovered =
                  (ui.hoveredId && (ui.hoveredId === sId || ui.hoveredId === tId)) ||
                  (ui.selectedId && (ui.selectedId === sId || ui.selectedId === tId));
                const inWinS =
                  !yearWindow || (edge.source.year >= yearWindow[0] && edge.source.year <= yearWindow[1]);
                const inWinT =
                  !yearWindow || (edge.target.year >= yearWindow[0] && edge.target.year <= yearWindow[1]);
                let opacity: number;
                if (inHighlightedPath) opacity = 0.9;
                else if (inTraceChain) opacity = 0.55;
                else if (isHighlightMode) opacity = 0.05;
                else if (hovered) opacity = 0.55;
                else if (yearWindow && (!inWinS || !inWinT)) opacity = 0.05;
                else opacity = 0.12;
                if (opacity < 0.04) return null;
                const stroke = DOMAIN_BY_ID[edge.source.domain].color;
                const sx1 = wxToSx(edge.source.x);
                const sx2 = wxToSx(edge.target.x);
                return (
                  <EdgePath
                    key={`${sId}_${tId}_${edge.type}`}
                    edge={edge}
                    sx1={sx1}
                    sy1={edge.source.y}
                    sx2={sx2}
                    sy2={edge.target.y}
                    stroke={stroke}
                    opacity={opacity}
                    emphasized={inHighlightedPath}
                  />
                );
              })}

            {/* Nodes */}
            {nodes.map((n) => {
              if (!ui.visibleDomains.has(n.domain)) return null;
              const visible = visibleSet.has(n.id);
              const isSelected = ui.selectedId === n.id;
              const isCompare = ui.compareIds.includes(n.id);
              const isAnc = highlight?.ancSet.has(n.id) ?? false;
              const isDesc = highlight?.descSet.has(n.id) ?? false;
              const isOnPath = highlight?.pathSet.has(n.id) ?? false;
              const inWin = !yearWindow || (n.year >= yearWindow[0] && n.year <= yearWindow[1]);

              let opacity = 1;
              if (!visible) return null;
              if (isHighlightMode) {
                if (isSelected || isCompare || isOnPath || isAnc || isDesc) opacity = 1;
                else opacity = 0.1;
              } else if (yearWindow && !inWin) opacity = 0.18;
              else if (ui.hoveredId && ui.hoveredId !== n.id) opacity = 0.92;

              const sx = wxToSx(n.x);
              if (sx < -30 || sx > innerW + 30) return null;
              const fill = DOMAIN_BY_ID[n.domain].color;
              let ringColor: string | null = null;
              let ringWidth = 0;
              if (isSelected) {
                ringColor = '#2c2519';
                ringWidth = 2.4;
              } else if (isCompare) {
                ringColor = '#7a2e3a';
                ringWidth = 2.2;
              } else if (isOnPath) {
                ringColor = '#574c39';
                ringWidth = 1.6;
              } else if (isAnc) {
                ringColor = '#1f3d5a';
                ringWidth = 1.6;
              } else if (isDesc) {
                ringColor = '#8c4a3e';
                ringWidth = 1.6;
              }
              const r = n.radius;
              const isFocus = visible && (isHighlightMode ? opacity === 1 : inWin);
              const labelOn =
                isFocus &&
                (n.importance >= 4 || isSelected || isCompare || isOnPath || isAnc || isDesc);

              return (
                <g
                  key={n.id}
                  transform={`translate(${sx}, ${n.y})`}
                  style={{ opacity, transition: 'opacity 180ms' }}
                  onClick={(e) => handleNodeClick(e, n.id)}
                  onMouseEnter={(e) => handleNodeEnter(e, n.id)}
                  onMouseLeave={handleNodeLeave}
                >
                  <circle r={r + 6} fill="transparent" style={{ cursor: 'pointer' }} />
                  <circle
                    r={r}
                    fill={fill}
                    stroke={n.frontier ? '#7a2e3a' : 'rgba(44,37,25,0.42)'}
                    strokeWidth={n.frontier ? 1.4 : 0.8}
                    strokeDasharray={n.frontier ? '2 2' : undefined}
                    className={n.frontier ? 'frontier-glow' : undefined}
                  />
                  {ringColor && (
                    <circle
                      r={r + 3}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth={ringWidth}
                      opacity={0.95}
                    />
                  )}
                  {labelOn && (
                    <text className="node-label" x={r + 4} y={3.5}>
                      {truncate(n.label, 36)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Year tick axis at bottom */}
          <g transform={`translate(0, ${innerH + 6})`} clipPath="url(#plot-clip)" pointerEvents="none">
            {tickYears.map((y) => {
              const sx = wxToSx(xScale.forward(y));
              if (sx < -40 || sx > innerW + 40) return null;
              return (
                <g key={y} transform={`translate(${sx}, 0)`}>
                  <line y1={0} y2={4} stroke="rgba(156,136,102,0.7)" strokeWidth={0.7} />
                  <text y={16} textAnchor="middle" className="tick-label">
                    {formatYear(y)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <NodeTooltip host={hostRef} hover={hover} nodes={layout.nodes} />

      <div className="pointer-events-none absolute bottom-1 left-3 font-serif text-[11px] italic text-ink-400">
        <span className="rounded bg-parchment-50/70 px-2 py-0.5">
          drag · scroll-zoom · click for detail · shift-click two to compare · press <kbd className="font-sans text-ink-700">I</kbd> to trace · <kbd className="font-sans text-ink-700">E</kbd> to toggle edges
        </span>
      </div>
    </div>
  );
}

/* ----- helpers ----- */

function edgeKey(a: string, b: string, type: string): string {
  return [a, b, type].sort().join('|');
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

interface EdgePathProps {
  edge: EdgeLink;
  sx1: number;
  sy1: number;
  sx2: number;
  sy2: number;
  stroke: string;
  opacity: number;
  emphasized: boolean;
}

function EdgePath({ edge, sx1, sy1, sx2, sy2, stroke, opacity, emphasized }: EdgePathProps) {
  const { source, target, type } = edge;
  const sameLane = source.laneIndex === target.laneIndex;
  const dx = sx2 - sx1;
  const dy = sy2 - sy1;
  const midX = (sx1 + sx2) / 2;
  const arc = sameLane ? Math.min(36, Math.abs(dx) * 0.22) : Math.abs(dy) * 0.22;
  const ctrlY = sameLane ? sy1 - arc : (sy1 + sy2) / 2 + (dy >= 0 ? -arc : arc);
  const d = `M ${sx1},${sy1} Q ${midX},${ctrlY} ${sx2},${sy2}`;
  const dash = type === 'influences' ? '3 3' : undefined;
  const marker =
    type === 'enables'
      ? 'url(#arrow-enables)'
      : type === 'refines'
        ? 'url(#arrow-refines)'
        : undefined;
  const width = emphasized ? 1.6 : 1;
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeDasharray={dash}
      markerEnd={marker}
      style={{ color: stroke }}
    />
  );
}

function pickTickYears(k: number): number[] {
  const out = new Set<number>([
    -150000, -100000, -40000, -10000, -3000, 0, 500, 1000, 1500, 1700, 1900, 2026,
  ]);
  if (k > 1.2) {
    [-50000, -5000, -1000, -500, 250, 800, 1200, 1400, 1600, 1800, 1850, 1950, 2000].forEach((y) =>
      out.add(y),
    );
  }
  if (k > 3) {
    [-2000, -300, 200, 1100, 1300, 1650, 1750, 1825, 1875, 1925, 1975, 2010, 2020].forEach((y) =>
      out.add(y),
    );
  }
  if (k > 9) {
    for (let y = 1700; y <= 2026; y += 25) out.add(y);
  }
  if (k > 16) {
    for (let y = 1900; y <= 2026; y += 10) out.add(y);
  }
  return [...out].sort((a, b) => a - b);
}
