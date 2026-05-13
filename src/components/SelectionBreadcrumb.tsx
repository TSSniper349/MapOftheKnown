import { useMemo } from 'react';
import type { PreparedEdge, PreparedNode } from '../App';
import type { UIActions, UIState } from '../hooks/useUIState';
import { DOMAIN_BY_ID } from '../data/domains';
import { formatYear } from '../lib/timeScale';

interface SelectionBreadcrumbProps {
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  ui: UIState & UIActions;
}

export function SelectionBreadcrumb({ nodes, edges, ui }: SelectionBreadcrumbProps) {
  const evNode = useMemo(
    () => (ui.selectedId ? nodes.find((n) => n.raw.id === ui.selectedId) ?? null : null),
    [nodes, ui.selectedId],
  );
  const counts = useMemo(() => {
    if (!ui.selectedId) return null;
    let incoming = 0;
    let outgoing = 0;
    for (const e of edges) {
      if (e.target === ui.selectedId) incoming += 1;
      if (e.source === ui.selectedId) outgoing += 1;
    }
    return { incoming, outgoing };
  }, [edges, ui.selectedId]);

  const personLabel = ui.selectedPerson;
  const conceptLabel = ui.selectedConcept;

  const items: { label: string; sub?: string; color?: string; onClear: () => void }[] = [];
  if (evNode) {
    const d = DOMAIN_BY_ID[evNode.raw.domain];
    items.push({
      label: evNode.raw.label,
      sub: `${formatYear(evNode.year)} · ${counts?.incoming ?? 0} incoming · ${
        counts?.outgoing ?? 0
      } outgoing`,
      color: d.color,
      onClear: () => ui.selectNode(null),
    });
  }
  if (personLabel) {
    items.push({
      label: personLabel,
      sub: 'person',
      color: '#574c39',
      onClear: () => ui.selectPerson(null),
    });
  }
  if (conceptLabel) {
    items.push({
      label: conceptLabel,
      sub: 'concept',
      color: '#7a2e3a',
      onClear: () => ui.selectConcept(null),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-col gap-1">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-2 rounded-md border border-parchment-300 bg-parchment-50/95 px-3 py-1.5 shadow-page"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: it.color ?? '#574c39' }}
          />
          <div className="leading-tight">
            <div className="font-serif text-[13px] text-ink-900">Selected: {it.label}</div>
            {it.sub && (
              <div className="font-sans text-[10px] uppercase tracking-wider text-ink-500">
                {it.sub}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={it.onClear}
            className="ml-2 rounded p-0.5 text-ink-500 hover:bg-parchment-200 hover:text-ink-700"
            aria-label="Clear selection"
            title="Clear selection (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3 L11 11 M11 3 L3 11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
