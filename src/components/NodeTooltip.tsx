import { useMemo } from 'react';
import type { EventNode } from '../types';
import { formatYear } from '../lib/timeScale';
import { DOMAIN_BY_ID } from '../data/domains';

interface NodeTooltipProps {
  host: (el: HTMLDivElement | null) => void;
  hover: { id: string; clientX: number; clientY: number } | null;
  nodes: EventNode[];
}

export function NodeTooltip({ hover, nodes }: NodeTooltipProps) {
  const node = useMemo(() => {
    if (!hover) return null;
    return nodes.find((n) => n.id === hover.id) ?? null;
  }, [hover, nodes]);

  if (!hover || !node) return null;

  const d = DOMAIN_BY_ID[node.domain];
  const dateStr =
    typeof node.rawDate === 'string' ? node.rawDate : formatYear(node.year);
  const x = Math.min(window.innerWidth - 340, hover.clientX + 14);
  const y = Math.min(window.innerHeight - 160, hover.clientY + 14);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-30 max-w-[320px] rounded-md border border-parchment-300 bg-parchment-50/95 px-3 py-2 shadow-card"
      style={{ left: x, top: y }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-serif text-[15px] font-medium text-ink-900">
          {node.label}
        </div>
        {node.frontier && (
          <span className="rounded-sm border border-domain-medicine/40 px-1 text-[10px] uppercase tracking-wide text-domain-medicine">
            frontier
          </span>
        )}
      </div>
      <div
        className="mt-0.5 text-[11px] uppercase tracking-wider"
        style={{ color: d.color }}
      >
        {d.label}
        <span className="ml-2 font-sans text-ink-500 lowercase">{dateStr}</span>
      </div>
      <p className="mt-1 line-clamp-3 font-serif text-[13px] leading-snug text-ink-700">
        {node.description}
      </p>
    </div>
  );
}
