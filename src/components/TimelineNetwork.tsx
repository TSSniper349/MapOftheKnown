import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { PreparedEdge, PreparedNode } from '../App';
import { useResizeObserver } from '../hooks/useResponsive';
import { createEraScale, formatYear } from '../lib/timeScale';
import { DOMAINS, DOMAIN_BY_ID, DOMAIN_INDEX, ERAS } from '../data/domains';
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
const FALLBACK = { width: 1200, height: 720 };

/**
 * Semantic-zoom level based on the years spanned by the visible window.
 * L0 globe (>5000y) | L1 continent (500-5000) | L2 country (50-500) | L3 street (<50)
 */
function levelForSpan(spanYears: number): 0 | 1 | 2 | 3 {
  if (spanYears > 5000) return 0;
  if (spanYears > 500) return 1;
  if (spanYears > 50) return 2;
  return 3;
}

const LEVEL_LABEL = ['Globe', 'Continent', 'Country', 'Street'];

export function TimelineNetwork({ nodes: rawNodes, edges: rawEdges, ui }: TimelineNetworkProps) {
  const [hostRef, measured] = useResizeObserver<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [hover, setHover] = useState<{ id: string; clientX: number; clientY: number } | null>(null);

  const width = measured.width > 0 ? measured.width : FALLBACK.width;
  const height = measured.height > 0 ? measured.height : FALLBACK.height;
  const innerW = Math.max(80, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(80, height - MARGIN.top - MARGIN.bottom);

  const layout = useMemo(() => {
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
      const secondary = e.secondarySource ? idToNode.get(e.secondarySource) ?? undefined : undefined;
      edges.push({
        source: s,
        target: t,
        secondarySource: secondary,
        type: e.type,
        description: e.description,
      });
    }

    const idx = buildIndex(positioned, edges);

    /* Lane density: for each lane, a 1D importance-weighted histogram across world-x. */
    const NBINS = 200;
    const densityByLane: Float32Array[] = [];
    for (let i = 0; i < laneCount; i++) densityByLane.push(new Float32Array(NBINS));
    for (const n of positioned) {
      const bin = Math.min(NBINS - 1, Math.max(0, Math.floor((n.x / innerW) * NBINS)));
      densityByLane[n.laneIndex][bin] += n.importance;
    }
    const densityMax = Math.max(
      1,
      ...densityByLane.flatMap((arr) => Array.from(arr)),
    );

    return { xScale, laneH, nodes: positioned, edges, idx, densityByLane, densityMax, NBINS };
  }, [rawNodes, rawEdges, innerW, innerH]);

  /* ----- d3 zoom (X-only) ----- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = d3.select(svg);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 64])
      .translateExtent([
        [-40, -40],
        [innerW + 40, innerH + 40],
      ])
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on('zoom', (event) => {
        const t = event.transform;
        setTransform(d3.zoomIdentity.translate(t.x, 0).scale(t.k));
      });
    sel.call(zoom);
    sel.on('dblclick.zoom', null);
    zoomBehaviorRef.current = zoom;
    return () => {
      sel.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, [innerW, innerH]);

  /* ----- yearWindow → zoom transform ----- */
  useEffect(() => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;
    const win = ui.yearWindow;
    const sel = d3.select(svg);
    if (!win) {
      sel.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      return;
    }
    const [y0, y1] = win;
    const x0 = layout.xScale.forward(y0);
    const x1 = layout.xScale.forward(y1);
    const spanPx = Math.max(8, x1 - x0);
    const k = Math.max(1, Math.min(64, innerW / spanPx));
    const tx = -x0 * k;
    const newT = d3.zoomIdentity.translate(tx, 0).scale(k);
    sel.transition().duration(420).call(zoom.transform, newT);
  }, [ui.yearWindow, layout.xScale, innerW, ui.teleportCounter]);

  /* ----- Teleport / search-pulse: center on selected node ----- */
  useEffect(() => {
    if (ui.teleportCounter === 0) return;
    if (!ui.selectedId) return;
    const node = layout.nodes.find((n) => n.id === ui.selectedId);
    if (!node) return;
    // Move to L2 (50-500y window) centered on the event.
    const halfSpan = 75; // years
    ui.setYearWindow([node.year - halfSpan, node.year + halfSpan]);
  }, [ui.teleportCounter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- Highlight (chain / compare) ----- */
  const highlight = useMemo(() => {
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

  /* ----- Visibility (domain, importance, search, person, concept) ----- */
  const visibleSet = useMemo(() => {
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
            const inConcept = (n.concepts ?? []).some((c) => c.toLowerCase().includes(q));
            if (!(inLabel || inDesc || inFig || inConcept)) return false;
          }
          if (ui.selectedPerson) {
            if (!(n.keyFigures ?? []).includes(ui.selectedPerson)) return false;
          }
          if (ui.selectedConcept) {
            if (!(n.concepts ?? []).includes(ui.selectedConcept)) return false;
          }
          return true;
        })
        .map((n) => n.id),
    );
  }, [
    layout,
    ui.visibleDomains,
    ui.importanceMin,
    ui.search,
    ui.selectedPerson,
    ui.selectedConcept,
  ]);

  /* ----- Keyboard ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'i' || e.key === 'I') ui.toggleTrace();
      else if (e.key === 'Escape') {
        if (ui.playing) ui.setPlaying(false);
        else ui.closeDetail();
      } else if (e.key === 'e' || e.key === 'E') ui.setShowEdges(!ui.showEdges);
      else if (e.key === 'ArrowLeft') stepYearWindow(ui, -50);
      else if (e.key === 'ArrowRight') stepYearWindow(ui, 50);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  /* ----- Playback ----- */
  useEffect(() => {
    if (!ui.playing) return;
    const speedYearsPerSec = 80;
    const stepMs = 60;
    const windowSpan = 300; // years
    const dataStart = ERAS[0].start;
    const dataEnd = ERAS[ERAS.length - 1].end;
    let start = ui.yearWindow ? ui.yearWindow[0] : -2000;
    let end = ui.yearWindow ? ui.yearWindow[1] : start + windowSpan;
    if (end - start < 60) end = start + windowSpan;
    const iv = window.setInterval(() => {
      const delta = (speedYearsPerSec * stepMs) / 1000;
      start += delta;
      end += delta;
      if (end >= dataEnd) {
        end = dataEnd;
        start = Math.max(dataStart, end - windowSpan);
        ui.setYearWindow([start, end]);
        ui.setPlaying(false);
        return;
      }
      ui.setYearWindow([start, end]);
    }, stepMs);
    return () => window.clearInterval(iv);
  }, [ui.playing]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { xScale, laneH, nodes, edges, densityByLane, densityMax, NBINS } = layout;
  const k = transform.k;
  const tx = transform.x;
  const wxToSx = (wx: number) => tx + wx * k;

  const yearWindow = ui.yearWindow;
  const isHighlightMode =
    (highlight.pathSet.size ?? 0) > 0 ||
    (highlight.ancSet.size ?? 0) + (highlight.descSet.size ?? 0) > 0;

  // Visible year span → semantic zoom level
  const visibleSpan = yearWindow
    ? yearWindow[1] - yearWindow[0]
    : ERAS[ERAS.length - 1].end - ERAS[0].start;
  const zoomLevel = levelForSpan(visibleSpan);

  const tickYears = pickTickYears(k, zoomLevel);
  const labelImportanceMin = zoomLevel === 0 ? 99 : zoomLevel === 1 ? 4 : zoomLevel === 2 ? 3 : 1;

  return (
    <div ref={hostRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        onClick={() => ui.selectNode(null)}
        style={{ cursor: 'grab', display: 'block', width: '100%', height: '100%' }}
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
          <marker
            id="arrow-synthesizes"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <circle cx="5" cy="5" r="3" fill="currentColor" />
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
            <rect x={0} y={-50} width={Math.max(1, innerW)} height={Math.max(1, innerH + 100)} />
          </clipPath>
        </defs>

        <rect width={width} height={height} fill="url(#parchment-grain)" />

        {/* Zoom-level indicator (top-right) */}
        <g transform={`translate(${width - 24}, 22)`}>
          <text textAnchor="end" className="era-label" fill="#7a6b53">
            {LEVEL_LABEL[zoomLevel]} · L{zoomLevel}
          </text>
        </g>

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

        {/* Plot area */}
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Lane bands + density stripes */}
          <g pointerEvents="none">
            {DOMAINS.map((_d, i) => (
              <rect
                key={i}
                x={0}
                y={i * laneH}
                width={innerW}
                height={laneH}
                fill={i % 2 === 0 ? 'rgba(155,140,114,0.045)' : 'rgba(212,197,164,0.08)'}
              />
            ))}
            {/* Density heatmap stripes: visible at all zoom levels but most prominent at L0/L1 */}
            <g clipPath="url(#plot-clip)" opacity={zoomLevel === 0 ? 0.75 : zoomLevel === 1 ? 0.5 : 0.3}>
              {DOMAINS.map((d, i) => {
                const density = densityByLane[i];
                const binW = innerW / NBINS;
                const cy = i * laneH + laneH / 2;
                const stripeH = Math.min(laneH * 0.55, 22);
                return (
                  <g key={i} transform={`translate(${tx}, 0) scale(${k}, 1)`}>
                    {Array.from(density).map((v, j) => {
                      if (v <= 0) return null;
                      const a = Math.pow(v / densityMax, 0.6) * 0.7;
                      return (
                        <rect
                          key={j}
                          x={j * binW}
                          y={cy - stripeH / 2}
                          width={binW + 0.2}
                          height={stripeH}
                          fill={d.color}
                          opacity={a}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
            {/* Gridlines */}
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

          {/* Era labels (top of plot) */}
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

          {/* Clipped content: era rules, window mask, edges, nodes */}
          <g clipPath="url(#plot-clip)">
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

            {ui.showEdges &&
              zoomLevel >= 1 &&
              edges.map((edge) => {
                const sId = edge.source.id;
                const tId = edge.target.id;
                if (!visibleSet.has(sId) || !visibleSet.has(tId)) return null;
                const inHighlightedPath = highlight.pathEdgeKeys.has(
                  edgeKey(sId, tId, edge.type),
                );
                const inTraceChain =
                  isHighlightMode &&
                  ((highlight.ancSet.has(sId) || sId === ui.selectedId) &&
                    (highlight.ancSet.has(tId) || tId === ui.selectedId) ||
                    (highlight.descSet.has(sId) || sId === ui.selectedId) &&
                      (highlight.descSet.has(tId) || tId === ui.selectedId));
                const hovered =
                  (ui.hoveredId && (ui.hoveredId === sId || ui.hoveredId === tId)) ||
                  (ui.selectedId && (ui.selectedId === sId || ui.selectedId === tId));
                const inWinS =
                  !yearWindow ||
                  (edge.source.year >= yearWindow[0] && edge.source.year <= yearWindow[1]);
                const inWinT =
                  !yearWindow ||
                  (edge.target.year >= yearWindow[0] && edge.target.year <= yearWindow[1]);
                // Base opacity by zoom level (brief §3)
                const baseOp = zoomLevel === 1 ? 0.06 : zoomLevel === 2 ? 0.12 : 0.22;
                let opacity: number;
                if (inHighlightedPath) opacity = 0.9;
                else if (inTraceChain) opacity = 0.55;
                else if (isHighlightMode) opacity = 0.04;
                else if (hovered) opacity = 0.55;
                else if (yearWindow && (!inWinS || !inWinT)) opacity = 0.04;
                else opacity = baseOp;
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

            {nodes.map((n) => {
              if (!ui.visibleDomains.has(n.domain)) return null;
              if (!visibleSet.has(n.id)) return null;
              const isSelected = ui.selectedId === n.id;
              const isCompare = ui.compareIds.includes(n.id);
              const isAnc = highlight.ancSet.has(n.id);
              const isDesc = highlight.descSet.has(n.id);
              const isOnPath = highlight.pathSet.has(n.id);
              const isPersonHit =
                ui.selectedPerson && (n.keyFigures ?? []).includes(ui.selectedPerson);
              const isConceptHit =
                ui.selectedConcept && (n.concepts ?? []).includes(ui.selectedConcept);
              const isPulsing = ui.pulseId === n.id;
              const inWin =
                !yearWindow || (n.year >= yearWindow[0] && n.year <= yearWindow[1]);

              let opacity = 1;
              if (isHighlightMode) {
                if (isSelected || isCompare || isOnPath || isAnc || isDesc) opacity = 1;
                else opacity = 0.08;
              } else if (yearWindow && !inWin) opacity = 0.18;
              else if (ui.hoveredId && ui.hoveredId !== n.id) opacity = 0.92;

              // Importance-priority dropout governed by zoom level
              if (
                !isSelected &&
                !isCompare &&
                !isAnc &&
                !isDesc &&
                !isOnPath &&
                !isPersonHit &&
                !isConceptHit &&
                !isPulsing &&
                zoomLevel === 0 &&
                n.importance < 5
              ) {
                // Top-50-only at L0 - approximate via importance gate
                opacity = Math.min(opacity, 0.7);
              }

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
              } else if (isPersonHit || isConceptHit) {
                ringColor = '#7a6b53';
                ringWidth = 1.4;
              }
              const r = n.radius;
              const focusedForLabel = isHighlightMode ? opacity === 1 : inWin;
              const labelOn =
                focusedForLabel &&
                (n.importance >= labelImportanceMin ||
                  isSelected ||
                  isCompare ||
                  isOnPath ||
                  isAnc ||
                  isDesc ||
                  isPersonHit ||
                  isConceptHit);

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
                  {/* Parchment halo for selected/compared (per v2 spec) */}
                  {(isSelected || isCompare) && (
                    <circle r={r + 4.5} fill="none" stroke="#FAF7F2" strokeWidth={2.5} />
                  )}
                  {/* Pulse on teleport */}
                  {isPulsing && (
                    <circle
                      r={r + 6}
                      fill="none"
                      stroke={fill}
                      strokeWidth={2}
                      opacity={0.6}
                      style={{ animation: 'pulse-ring 1.4s ease-out forwards' }}
                    />
                  )}
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
                      {truncate(n.label, zoomLevel === 3 ? 60 : 36)}
                    </text>
                  )}
                  {labelOn && zoomLevel === 3 && n.importance >= 4 && (
                    <text
                      className="node-label"
                      x={r + 4}
                      y={16}
                      style={{ fontSize: 9, fill: '#7a6b53', strokeWidth: 2 }}
                    >
                      {truncate(n.description, 80)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Bottom year-tick axis */}
          <g
            transform={`translate(0, ${innerH + 6})`}
            clipPath="url(#plot-clip)"
            pointerEvents="none"
          >
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

      <div className="pointer-events-none absolute bottom-1 right-3 font-serif text-[11px] italic text-ink-400">
        <span className="rounded bg-parchment-50/70 px-2 py-0.5">
          drag · scroll-zoom · click for detail · shift-click two to compare ·{' '}
          <kbd className="font-sans text-ink-700">I</kbd> trace ·{' '}
          <kbd className="font-sans text-ink-700">E</kbd> edges ·{' '}
          <kbd className="font-sans text-ink-700">Space</kbd> play
        </span>
      </div>
    </div>
  );
}

function stepYearWindow(ui: UIState & UIActions, deltaYears: number) {
  const w = ui.yearWindow;
  if (!w) {
    ui.setYearWindow([1700 + deltaYears, 1900 + deltaYears]);
    return;
  }
  ui.setYearWindow([w[0] + deltaYears, w[1] + deltaYears]);
}

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
  let dash: string | undefined;
  let marker: string | undefined;
  if (type === 'influences') dash = '3 3';
  else if (type === 'parallel') dash = '1 4';
  if (type === 'enables') marker = 'url(#arrow-enables)';
  else if (type === 'refines') marker = 'url(#arrow-refines)';
  else if (type === 'synthesizes') marker = 'url(#arrow-synthesizes)';
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
      strokeLinecap="round"
      style={{ color: stroke }}
    />
  );
}

function pickTickYears(k: number, zoomLevel: number): number[] {
  const out = new Set<number>([
    -150000, -100000, -40000, -10000, -3000, 0, 500, 1000, 1500, 1700, 1900, 2026,
  ]);
  if (zoomLevel >= 1) {
    [-50000, -5000, -1000, -500, 250, 800, 1200, 1400, 1600, 1800, 1850, 1950, 2000].forEach((y) =>
      out.add(y),
    );
  }
  if (zoomLevel >= 2 || k > 3) {
    [-2000, -300, 200, 1100, 1300, 1650, 1750, 1825, 1875, 1925, 1975, 2010, 2020].forEach((y) =>
      out.add(y),
    );
  }
  if (zoomLevel >= 3 || k > 9) {
    for (let y = 1700; y <= 2026; y += 25) out.add(y);
  }
  if (k > 16) {
    for (let y = 1900; y <= 2026; y += 10) out.add(y);
  }
  return [...out].sort((a, b) => a - b);
}
