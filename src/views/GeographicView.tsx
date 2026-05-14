import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry, MultiLineString } from 'geojson';
import type { PreparedNode } from '../App';
import { useResizeObserver } from '../hooks/useResponsive';
import { DOMAIN_BY_ID } from '../data/domains';
import { formatYear } from '../lib/timeScale';
import type { UIActions, UIState } from '../hooks/useUIState';
import type { Location, RawEvent } from '../types';

interface GeographicViewProps {
  nodes: PreparedNode[];
  ui: UIState & UIActions;
}

interface WorldShapes {
  land: FeatureCollection;
  borders: MultiLineString;
}

export function GeographicView({ nodes, ui }: GeographicViewProps) {
  const [hostRef, size] = useResizeObserver<HTMLDivElement>();
  const [world, setWorld] = useState<WorldShapes | null>(null);
  const [hover, setHover] = useState<{ id: string; clientX: number; clientY: number } | null>(null);
  const [k, setK] = useState(1);
  const [translate, setTranslate] = useState<[number, number]>([0, 0]);
  const svgRef = useRef<SVGSVGElement>(null);

  /* ----- Load TopoJSON ----- */
  useEffect(() => {
    let alive = true;
    fetch(import.meta.env.BASE_URL + 'topojson/world-50m.json')
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (!alive) return;
        const landKey = topo.objects.land ? 'land' : Object.keys(topo.objects)[0];
        const obj = topo.objects[landKey] as GeometryCollection;
        const landFC = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
        const borderMesh = mesh(topo, obj) as MultiLineString;
        setWorld({ land: landFC, borders: borderMesh });
      })
      .catch(() => setWorld(null));
    return () => {
      alive = false;
    };
  }, []);

  /* ----- Year-window filter ----- */
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (!ui.visibleDomains.has(n.raw.domain)) return false;
      if (n.raw.importance < ui.importanceMin) return false;
      if (ui.frontierOnly && !n.raw.frontier) return false;
      if (ui.yearWindow && (n.year < ui.yearWindow[0] || n.year > ui.yearWindow[1])) return false;
      if (ui.selectedPerson && !(n.raw.keyFigures ?? []).includes(ui.selectedPerson)) return false;
      if (ui.selectedConcept && !(n.raw.concepts ?? []).includes(ui.selectedConcept)) return false;
      return true;
    });
  }, [nodes, ui.visibleDomains, ui.importanceMin, ui.frontierOnly, ui.yearWindow, ui.selectedPerson, ui.selectedConcept]);

  const width = Math.max(200, size.width || 1200);
  const height = Math.max(200, size.height || 720);

  /* ----- Projection ----- */
  const projection = useMemo(() => {
    return d3
      .geoEqualEarth()
      .scale(Math.min(width / 6.5, height / 3.2))
      .translate([width / 2, height / 2]);
  }, [width, height]);

  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);

  /* ----- d3 zoom on the SVG ----- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = d3.select(svg);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 12])
      .on('zoom', (event) => {
        setK(event.transform.k);
        setTranslate([event.transform.x, event.transform.y]);
      });
    sel.call(zoom);
    sel.on('dblclick.zoom', null);
    return () => {
      sel.on('.zoom', null);
    };
  }, []);

  /* ----- Project events to (x, y) and cluster ----- */
  const projected = useMemo(() => {
    type ProjectedMarker = {
      event: RawEvent;
      year: number;
      location: Location;
      px: number;
      py: number;
    };
    const all: ProjectedMarker[] = [];
    for (const n of visibleNodes) {
      const locs = n.raw.locations ?? [];
      for (const loc of locs) {
        const p = projection([loc.lon, loc.lat]);
        if (!p) continue;
        all.push({ event: n.raw, year: n.year, location: loc, px: p[0], py: p[1] });
      }
    }
    return all;
  }, [visibleNodes, projection]);

  /**
   * Knowledge centroid: importance-weighted geographic mean of currently-visible
   * events, projected to screen. As the time scrubber moves, this marker drifts
   * across continents — making the migration of knowledge legible at a glance
   * (Greece → Persia → China → Europe → North America).
   */
  const centroid = useMemo(() => {
    if (projected.length === 0) return null;
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (const m of projected) {
      const w = m.event.importance;
      sx += m.px * w;
      sy += m.py * w;
      sw += w;
    }
    if (sw === 0) return null;
    return { x: sx / sw, y: sy / sw, weight: sw, count: projected.length };
  }, [projected]);

  /* ----- Cluster aggregation when zoomed out ----- */
  const clusters = useMemo(() => {
    if (k > 2.5) return null; // show individual markers
    const cellSize = Math.max(28, 56 / k);
    const map = new Map<
      string,
      { cx: number; cy: number; eventIds: Set<string>; markers: typeof projected }
    >();
    for (const m of projected) {
      const cx = Math.floor(m.px / cellSize);
      const cy = Math.floor(m.py / cellSize);
      const key = `${cx},${cy}`;
      let c = map.get(key);
      if (!c) {
        c = { cx: 0, cy: 0, eventIds: new Set(), markers: [] };
        map.set(key, c);
      }
      c.cx += m.px;
      c.cy += m.py;
      c.markers.push(m);
      c.eventIds.add(m.event.id);
    }
    const out: {
      cx: number;
      cy: number;
      count: number;
      domains: Map<string, number>;
      eventIds: Set<string>;
    }[] = [];
    for (const c of map.values()) {
      const count = c.markers.length;
      const cx = c.cx / count;
      const cy = c.cy / count;
      const domains = new Map<string, number>();
      for (const m of c.markers) {
        domains.set(m.event.domain, (domains.get(m.event.domain) ?? 0) + 1);
      }
      out.push({ cx, cy, count, domains, eventIds: c.eventIds });
    }
    return out;
  }, [projected, k]);

  const handleMarkerEnter = useCallback(
    (e: React.MouseEvent, id: string) => {
      setHover({ id, clientX: e.clientX, clientY: e.clientY });
      ui.setHovered(id);
    },
    [ui],
  );
  const handleMarkerLeave = useCallback(() => {
    setHover(null);
    ui.setHovered(null);
  }, [ui]);

  const tx = translate[0];
  const ty = translate[1];

  return (
    <div ref={hostRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
        onClick={() => ui.selectNode(null)}
      >
        <defs>
          <pattern id="ocean-grain" patternUnits="userSpaceOnUse" width="40" height="40">
            <rect width="40" height="40" fill="#FAF7F2" />
            <circle cx="10" cy="15" r="0.5" fill="rgba(120,100,80,0.05)" />
            <circle cx="30" cy="25" r="0.5" fill="rgba(120,100,80,0.04)" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#ocean-grain)" />

        <g transform={`translate(${tx}, ${ty}) scale(${k})`}>
          {/* Sphere outline */}
          <path
            d={pathGen({ type: 'Sphere' }) ?? ''}
            fill="rgba(244,239,229,0.9)"
            stroke="rgba(156,136,102,0.5)"
            strokeWidth={1 / k}
          />
          {/* Graticule */}
          <path
            d={pathGen(d3.geoGraticule10()) ?? ''}
            fill="none"
            stroke="rgba(156,136,102,0.18)"
            strokeWidth={0.5 / k}
          />
          {/* Land */}
          {world && (
            <>
              <path
                d={pathGen(world.land) ?? ''}
                fill="rgba(212,197,164,0.35)"
                stroke="none"
              />
              <path
                d={pathGen(world.borders) ?? ''}
                fill="none"
                stroke="rgba(120,100,80,0.4)"
                strokeWidth={0.6 / k}
              />
            </>
          )}

          {/* Multi-location connectors (dotted lines between markers of same event) */}
          {k > 1.2 &&
            visibleNodes.map((n) => {
              const locs = n.raw.locations ?? [];
              if (locs.length < 2) return null;
              const pts: [number, number][] = [];
              for (const l of locs) {
                const p = projection([l.lon, l.lat]);
                if (p) pts.push(p);
              }
              if (pts.length < 2) return null;
              const d = DOMAIN_BY_ID[n.raw.domain];
              const path =
                'M ' + pts[0][0] + ',' + pts[0][1] + ' ' + pts.slice(1).map((p) => `L ${p[0]},${p[1]}`).join(' ');
              return (
                <path
                  key={'conn_' + n.raw.id}
                  d={path}
                  fill="none"
                  stroke={d.color}
                  strokeOpacity={0.45}
                  strokeWidth={0.8 / k}
                  strokeDasharray={`${3 / k} ${3 / k}`}
                />
              );
            })}

          {/* Markers or clusters */}
          {clusters && k <= 2.5
            ? clusters.map((c, i) => {
                const r = Math.min(22, Math.max(6, Math.sqrt(c.count) * 3.5)) / k;
                const slices = pieSlices(c.domains, r);
                const sel = [...c.eventIds].includes(ui.selectedId ?? '');
                return (
                  <g
                    key={i}
                    transform={`translate(${c.cx}, ${c.cy})`}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Click cluster: pick the highest-importance event inside it.
                      const top = [...c.eventIds]
                        .map((id) => nodes.find((nn) => nn.raw.id === id))
                        .filter((x): x is PreparedNode => !!x)
                        .sort((a, b) => b.raw.importance - a.raw.importance)[0];
                      if (top) ui.selectNode(top.raw.id);
                    }}
                  >
                    <circle r={r + 0.5 / k} fill="rgba(250,247,242,0.95)" stroke="rgba(120,100,80,0.5)" strokeWidth={0.8 / k} />
                    {slices.map((s, j) => (
                      <path key={j} d={s.d} fill={s.color} opacity={0.85} />
                    ))}
                    {c.count > 1 && (
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={Math.max(8, 11 / k)}
                        fill="#2c2519"
                        fontFamily="Inter, sans-serif"
                        fontWeight={500}
                      >
                        {c.count}
                      </text>
                    )}
                    {sel && (
                      <circle r={r + 3 / k} fill="none" stroke="#2c2519" strokeWidth={1.6 / k} />
                    )}
                  </g>
                );
              })
            : projected.map((m, i) => {
                const d = DOMAIN_BY_ID[m.event.domain];
                const sel = ui.selectedId === m.event.id;
                const hov = ui.hoveredId === m.event.id;
                const r = (Math.max(3, m.event.importance * 1.3) + (sel ? 2 : 0)) / k;
                return (
                  <g
                    key={i}
                    transform={`translate(${m.px}, ${m.py})`}
                    onMouseEnter={(e) => handleMarkerEnter(e, m.event.id)}
                    onMouseLeave={handleMarkerLeave}
                    onClick={(e) => {
                      e.stopPropagation();
                      ui.selectNode(m.event.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {sel && (
                      <circle r={r + 3 / k} fill="none" stroke="#FAF7F2" strokeWidth={2.5 / k} />
                    )}
                    <circle
                      r={r}
                      fill={d.color}
                      stroke={m.event.frontier ? '#7a2e3a' : 'rgba(44,37,25,0.45)'}
                      strokeWidth={(m.event.frontier ? 1.2 : 0.6) / k}
                      strokeDasharray={m.event.frontier ? `${2 / k} ${2 / k}` : undefined}
                    />
                    {sel && (
                      <circle r={r + 2 / k} fill="none" stroke="#2c2519" strokeWidth={1.5 / k} />
                    )}
                    {(sel || hov || k >= 4) && (
                      <text
                        x={r + 3 / k}
                        y={3 / k}
                        fontSize={Math.max(8, 11 / k)}
                        className="node-label"
                      >
                        {m.event.label}
                      </text>
                    )}
                  </g>
                );
              })}

          {centroid && (
            <g
              transform={`translate(${centroid.x}, ${centroid.y})`}
              style={{ pointerEvents: 'none' }}
            >
              <circle r={22 / k} fill="rgba(122,46,58,0.07)" stroke="none">
                <animate
                  attributeName="r"
                  values={`${18 / k};${30 / k};${18 / k}`}
                  dur="3.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.7;0.2;0.7"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                r={9 / k}
                fill="none"
                stroke="rgba(122,46,58,0.85)"
                strokeWidth={1.2 / k}
                strokeDasharray={`${3 / k} ${2 / k}`}
              />
              <circle r={2.4 / k} fill="rgba(122,46,58,0.95)" />
              {/* crosshair ticks */}
              <line
                x1={-12 / k}
                x2={-6 / k}
                y1={0}
                y2={0}
                stroke="rgba(122,46,58,0.7)"
                strokeWidth={1 / k}
              />
              <line
                x1={6 / k}
                x2={12 / k}
                y1={0}
                y2={0}
                stroke="rgba(122,46,58,0.7)"
                strokeWidth={1 / k}
              />
              <line
                y1={-12 / k}
                y2={-6 / k}
                x1={0}
                x2={0}
                stroke="rgba(122,46,58,0.7)"
                strokeWidth={1 / k}
              />
              <line
                y1={6 / k}
                y2={12 / k}
                x1={0}
                x2={0}
                stroke="rgba(122,46,58,0.7)"
                strokeWidth={1 / k}
              />
              <text
                x={14 / k}
                y={-10 / k}
                fontSize={Math.max(8, 10 / k)}
                fill="rgba(122,46,58,0.9)"
                fontFamily="EB Garamond, serif"
                fontStyle="italic"
              >
                centroid
              </text>
            </g>
          )}
        </g>
      </svg>

      {hover && (
        <MapTooltip
          hover={hover}
          node={nodes.find((n) => n.raw.id === hover.id) ?? null}
        />
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-parchment-300 bg-parchment-50/85 px-3 py-1.5 shadow-page">
        <div className="font-serif text-xs uppercase tracking-wider text-ink-500">
          Geographic view
        </div>
        <div className="font-serif text-[11px] text-ink-400">
          Equal Earth · {projected.length} markers · scroll to zoom
        </div>
        {centroid && (
          <div className="mt-1 flex items-center gap-1.5 border-t border-parchment-300/60 pt-1 font-serif text-[10.5px] italic text-domain-medicine/90">
            <svg width="10" height="10" viewBox="-5 -5 10 10">
              <circle r="3.5" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1" />
              <circle r="1" fill="currentColor" />
            </svg>
            knowledge centroid · scrub time to watch it migrate
          </div>
        )}
      </div>
    </div>
  );
}

function pieSlices(domains: Map<string, number>, r: number): { d: string; color: string }[] {
  const total = [...domains.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  let a0 = -Math.PI / 2;
  const slices: { d: string; color: string }[] = [];
  for (const [domain, count] of domains) {
    const a1 = a0 + (count / total) * 2 * Math.PI;
    const x0 = r * Math.cos(a0);
    const y0 = r * Math.sin(a0);
    const x1 = r * Math.cos(a1);
    const y1 = r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M 0,0 L ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
    slices.push({
      d,
      color: DOMAIN_BY_ID[domain as keyof typeof DOMAIN_BY_ID]?.color ?? '#574c39',
    });
    a0 = a1;
  }
  return slices;
}

function MapTooltip({
  hover,
  node,
}: {
  hover: { id: string; clientX: number; clientY: number };
  node: PreparedNode | null;
}) {
  if (!node) return null;
  const d = DOMAIN_BY_ID[node.raw.domain];
  const x = Math.min(window.innerWidth - 320, hover.clientX + 14);
  const y = Math.min(window.innerHeight - 160, hover.clientY + 14);
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-30 max-w-[320px] rounded-md border border-parchment-300 bg-parchment-50/95 px-3 py-2 shadow-card"
      style={{ left: x, top: y }}
    >
      <div className="font-serif text-[15px] font-medium text-ink-900">{node.raw.label}</div>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: d.color }}>
        {d.label}
        <span className="ml-2 font-sans text-ink-500 lowercase">{formatYear(node.year)}</span>
      </div>
      {(node.raw.locations ?? [])[0] && (
        <div className="mt-1 font-serif text-[12.5px] italic text-ink-500">
          {(node.raw.locations ?? [])[0].label}
        </div>
      )}
    </div>
  );
}
