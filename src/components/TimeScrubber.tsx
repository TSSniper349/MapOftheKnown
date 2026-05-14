import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreparedNode } from '../App';
import { ERAS } from '../data/domains';
import { createEraScale, formatYear } from '../lib/timeScale';
import type { UIActions, UIState } from '../hooks/useUIState';

interface TimeScrubberProps {
  nodes: PreparedNode[];
  ui: UIState & UIActions;
}

const TRACK_HEIGHT = 64;
const PAD_LEFT = 132;
const PAD_RIGHT = 24;
const FULL_DOMAIN: [number, number] = [ERAS[0].start, ERAS[ERAS.length - 1].end];

export function TimeScrubber({ nodes, ui }: TimeScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [drag, setDrag] = useState<'left' | 'right' | 'window' | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const dragStart = useRef<{ mouseX: number; window: [number, number] } | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setTrackW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(0, trackW);
  const xScale = useMemo(() => createEraScale(0, innerW), [innerW]);
  const winYears: [number, number] = ui.yearWindow ?? FULL_DOMAIN;

  const bins = useMemo(() => {
    if (innerW < 4) return [];
    const W = 4;
    const count = Math.ceil(innerW / W);
    const arr: { x: number; w: number; importance: number; major: number; minor: number }[] =
      Array.from({ length: count }, (_, i) => ({
        x: i * W,
        w: W,
        importance: 0,
        major: 0,
        minor: 0,
      }));
    for (const n of nodes) {
      const sx = xScale.forward(n.year);
      const i = Math.min(count - 1, Math.max(0, Math.floor(sx / W)));
      arr[i].importance += n.raw.importance;
      if (n.raw.importance >= 4) arr[i].major += 1;
      else arr[i].minor += 1;
    }
    return arr;
  }, [innerW, nodes, xScale]);

  const maxBin = useMemo(
    () => bins.reduce((m, b) => Math.max(m, b.importance), 1),
    [bins],
  );

  const yearAtMouse = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return FULL_DOMAIN[0];
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerW, clientX - r.left));
      return xScale.inverse(x);
    },
    [innerW, xScale],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, kind: 'left' | 'right' | 'window') => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag(kind);
      dragStart.current = { mouseX: e.clientX, window: [...winYears] };
    },
    [winYears],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const r = trackRef.current?.getBoundingClientRect();
      if (!r) return;
      if (drag === 'window') {
        const start = dragStart.current!;
        const startW = xScale.forward(start.window[0]);
        const endW = xScale.forward(start.window[1]);
        const dx = e.clientX - start.mouseX;
        const w = endW - startW;
        const newStartX = Math.max(0, Math.min(innerW - w, startW + dx));
        ui.setYearWindow([xScale.inverse(newStartX), xScale.inverse(newStartX + w)]);
        return;
      }
      const y = yearAtMouse(e.clientX);
      if (drag === 'left') {
        const right = winYears[1];
        const min = FULL_DOMAIN[0];
        const safe = Math.max(min, Math.min(right - 0.001, y));
        ui.setYearWindow([safe, right]);
      } else if (drag === 'right') {
        const left = winYears[0];
        const max = FULL_DOMAIN[1];
        const safe = Math.min(max, Math.max(left + 0.001, y));
        ui.setYearWindow([left, safe]);
      }
    },
    [drag, innerW, ui, winYears, xScale, yearAtMouse],
  );

  const onPointerUp = useCallback(() => {
    setDrag(null);
    dragStart.current = null;
  }, []);

  const jumpToEra = useCallback(
    (idx: number) => {
      const e = ERAS[idx];
      ui.setYearWindow([e.start, e.end]);
    },
    [ui],
  );
  const resetWindow = useCallback(() => ui.setYearWindow(null), [ui]);

  const x0 = xScale.forward(winYears[0]);
  const x1 = xScale.forward(winYears[1]);

  if (collapsed) {
    return (
      <footer
        className="z-10 flex h-7 shrink-0 select-none items-center justify-between border-t border-parchment-300 bg-parchment-50/90 shadow-page transition-[height] duration-200 ease-out hover:h-9"
        style={{ paddingLeft: PAD_LEFT - 8, paddingRight: PAD_RIGHT }}
      >
        <div className="flex items-center gap-3 font-serif text-xs italic text-ink-500">
          <span className="text-[10px] uppercase not-italic tracking-[0.2em] text-ink-400">
            timeline
          </span>
          <span>
            {formatYear(winYears[0])}
            <span className="mx-2">to</span>
            {formatYear(winYears[1])}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-ink-500 hover:bg-parchment-200/70 hover:text-ink-700"
          aria-label="Expand timeline"
          title="Expand timeline"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 9 L7 5 L11 9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </footer>
    );
  }

  return (
    <footer
      className="group/scrubber z-10 flex h-[110px] shrink-0 select-none flex-col justify-end border-t border-parchment-300 bg-parchment-50/90 shadow-page transition-[height] duration-200 ease-out hover:h-[124px]"
      style={{ paddingLeft: PAD_LEFT - 8, paddingRight: PAD_RIGHT }}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={ui.togglePlay}
            className={`rounded-md border px-2 py-1 font-sans text-xs ${
              ui.playing
                ? 'border-domain-medicine bg-domain-medicine text-parchment-50'
                : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-200'
            }`}
            aria-pressed={ui.playing}
            title="Play / pause (Space)"
          >
            {ui.playing ? '❚❚ pause' : '▶ play'}
          </button>
          <select
            value={ui.playSpeed}
            onChange={(e) =>
              ui.setPlaySpeed(Number(e.target.value) as 30 | 80 | 200 | 500)
            }
            className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-700"
            aria-label="Playback speed (years per second)"
            title="Playback speed (years per second)"
          >
            <option value={30}>30 y/s</option>
            <option value={80}>80 y/s</option>
            <option value={200}>200 y/s</option>
            <option value={500}>500 y/s</option>
          </select>
          {ERAS.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => jumpToEra(i)}
              className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-serif text-xs text-ink-700 hover:bg-parchment-200"
            >
              {e.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetWindow}
            className="rounded-md border border-ink-600/40 bg-ink-700 px-2 py-1 font-sans text-xs text-parchment-50 hover:bg-ink-800"
          >
            Full
          </button>
        </div>
        <div className="flex items-center gap-2 font-serif text-xs italic text-ink-500">
          <span>
            {formatYear(winYears[0])}
            <span className="mx-2">to</span>
            {formatYear(winYears[1])}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 not-italic text-ink-500 hover:bg-parchment-200/70 hover:text-ink-700"
            aria-label="Collapse timeline"
            title="Collapse timeline"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5 L7 9 L11 5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-[64px] w-full rounded border border-parchment-300 bg-parchment-50"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <svg
          width="100%"
          height={TRACK_HEIGHT - 4}
          viewBox={`0 0 ${innerW} ${TRACK_HEIGHT - 4}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          {bins.map((b, i) => {
            const h = ((b.importance / maxBin) * (TRACK_HEIGHT - 18)) | 0;
            const inside = b.x + b.w / 2 >= x0 && b.x + b.w / 2 <= x1;
            return (
              <rect
                key={i}
                x={b.x}
                y={TRACK_HEIGHT - 4 - h - 8}
                width={b.w - 0.5}
                height={Math.max(0.5, h)}
                fill={inside ? '#574c39' : '#9c8866'}
                opacity={inside ? 0.85 : 0.4}
              />
            );
          })}

          {xScale.eraBounds.slice(0, -1).map(({ era, x1: x }) => (
            <line
              key={era.id}
              x1={x}
              x2={x}
              y1={4}
              y2={TRACK_HEIGHT - 4}
              stroke="rgba(156,136,102,0.6)"
              strokeDasharray="2 3"
              strokeWidth={0.8}
            />
          ))}

          {xScale.eraBounds.map(({ era, x0: ex0, x1: ex1 }) => {
            const center = (ex0 + ex1) / 2;
            return (
              <text
                key={`lbl-${era.id}`}
                x={center}
                y={11}
                textAnchor="middle"
                className="tick-label"
                fill="rgba(87,76,57,0.7)"
                style={{ fontSize: 9 }}
              >
                {era.label.toUpperCase()}
              </text>
            );
          })}

          <rect x={0} y={0} width={x0} height={TRACK_HEIGHT - 4} fill="rgba(250,247,242,0.55)" />
          <rect
            x={x1}
            y={0}
            width={Math.max(0, innerW - x1)}
            height={TRACK_HEIGHT - 4}
            fill="rgba(250,247,242,0.55)"
          />
          <rect
            x={x0}
            y={0}
            width={Math.max(2, x1 - x0)}
            height={TRACK_HEIGHT - 4}
            fill="rgba(122,46,58,0.05)"
            stroke="rgba(122,46,58,0.55)"
            strokeWidth={1}
          />
        </svg>

        <div
          onPointerDown={(e) => onPointerDown(e, 'window')}
          className="absolute top-0"
          style={{
            left: x0,
            width: Math.max(2, x1 - x0),
            height: TRACK_HEIGHT - 4,
            cursor: drag === 'window' ? 'grabbing' : 'grab',
          }}
        />
        <button
          type="button"
          aria-label="Start of window"
          onPointerDown={(e) => onPointerDown(e, 'left')}
          className="absolute top-0 flex h-full w-3 items-center justify-center border-r border-domain-medicine bg-parchment-100/40 hover:bg-domain-medicine/10"
          style={{ left: x0 - 6, cursor: 'ew-resize' }}
        >
          <span className="block h-6 w-[2px] rounded bg-domain-medicine" />
        </button>
        <button
          type="button"
          aria-label="End of window"
          onPointerDown={(e) => onPointerDown(e, 'right')}
          className="absolute top-0 flex h-full w-3 items-center justify-center border-l border-domain-medicine bg-parchment-100/40 hover:bg-domain-medicine/10"
          style={{ left: x1 - 6, cursor: 'ew-resize' }}
        >
          <span className="block h-6 w-[2px] rounded bg-domain-medicine" />
        </button>
      </div>
    </footer>
  );
}
