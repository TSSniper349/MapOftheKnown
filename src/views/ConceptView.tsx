import { useMemo, useState } from 'react';
import type { PreparedNode } from '../App';
import { DOMAIN_BY_ID, DOMAINS } from '../data/domains';
import { formatYear } from '../lib/timeScale';
import type { UIActions, UIState } from '../hooks/useUIState';
import type { DerivedTables } from '../lib/derive';
import type { ConceptRecord, DomainId } from '../types';

interface ConceptViewProps {
  nodes: PreparedNode[];
  derived: DerivedTables;
  ui: UIState & UIActions;
}

/**
 * Concept tree: groups concepts by their dominant domain (a derived hierarchy
 * extracted automatically). Click a concept to highlight its events in the
 * time-axis view; click again to clear.
 */
export function ConceptView({ nodes, derived, ui }: ConceptViewProps) {
  const [query, setQuery] = useState('');
  /* ----- Group concepts by their dominant domain ----- */
  const grouped = useMemo(() => {
    const groups = new Map<DomainId, ConceptRecord[]>();
    for (const d of DOMAINS) groups.set(d.id, []);
    for (const c of derived.concepts.values()) {
      // primary domain = most frequent
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

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-parchment-100">
      <div className="border-b border-parchment-300 bg-parchment-50/95 px-6 py-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-xl text-ink-900">Concepts</h2>
            <p className="font-serif text-xs italic text-ink-500">
              {totalConcepts.toLocaleString()} concept tags, grouped by their dominant domain.
              Click a tag to highlight its events across views.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter concepts…"
            type="search"
            className="w-64 rounded-md border border-parchment-300 bg-parchment-50 px-3 py-1.5 font-serif text-sm text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4 scroll-soft">
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
                  <span className="ml-2 font-sans text-[10px] text-ink-400">
                    {filtered.length}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map((c) => {
                    const isSel = ui.selectedConcept === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          ui.selectConcept(isSel ? null : c.id)
                        }
                        className={`rounded-full border px-2.5 py-0.5 font-serif text-[13px] transition-colors ${
                          isSel
                            ? 'border-ink-700 bg-ink-700 text-parchment-50'
                            : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-200/70'
                        } ${c.frontier ? 'ring-1 ring-domain-medicine/40' : ''}`}
                      >
                        {c.id}
                        <span
                          className={`ml-1.5 text-[10px] ${
                            isSel ? 'text-parchment-200' : 'text-ink-400'
                          }`}
                        >
                          {c.events.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
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
                        <span className="block text-[10px] uppercase tracking-wider" style={{ color: d.color }}>
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
