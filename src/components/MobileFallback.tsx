import { useMemo, useState } from 'react';
import type { PreparedNode } from '../App';
import { DOMAIN_BY_ID, ERAS } from '../data/domains';
import { formatYear } from '../lib/timeScale';
import type { DomainId } from '../types';

interface MobileFallbackProps {
  nodes: PreparedNode[];
}

export function MobileFallback({ nodes }: MobileFallbackProps) {
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<DomainId | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      if (domainFilter !== 'all' && n.raw.domain !== domainFilter) return false;
      if (!q) return true;
      return (
        n.raw.label.toLowerCase().includes(q) ||
        n.raw.description.toLowerCase().includes(q) ||
        (n.raw.keyFigures ?? []).some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [nodes, query, domainFilter]);

  const grouped = useMemo(() => {
    return ERAS.map((era) => {
      const events = filtered
        .filter((n) => n.year >= era.start && n.year <= era.end)
        .sort((a, b) => a.year - b.year);
      return { era, events };
    });
  }, [filtered]);

  return (
    <div className="h-full overflow-y-auto bg-parchment-100 px-5 pb-12">
      <header className="sticky top-0 z-10 -mx-5 mb-4 border-b border-parchment-300 bg-parchment-50/95 px-5 pb-3 pt-4 shadow-page">
        <h1 className="font-serif text-2xl text-ink-900">Map of the Known</h1>
        <p className="font-serif text-xs italic text-ink-500">
          The full network is too dense for small screens. Browse the era list below.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, figures…"
          className="mt-3 w-full rounded-md border border-parchment-300 bg-parchment-50 px-3 py-2 font-serif text-sm text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          type="search"
          aria-label="Search"
        />
        <div className="mt-2 flex gap-1 overflow-x-auto">
          <button
            onClick={() => setDomainFilter('all')}
            className={`rounded-full border px-3 py-1 text-xs ${
              domainFilter === 'all'
                ? 'border-ink-700 bg-ink-700 text-parchment-50'
                : 'border-parchment-300 bg-parchment-50 text-ink-700'
            }`}
          >
            all
          </button>
          {Object.entries(DOMAIN_BY_ID).map(([id, d]) => (
            <button
              key={id}
              onClick={() => setDomainFilter(id as DomainId)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                domainFilter === id
                  ? 'border-ink-700 bg-ink-100 text-ink-800'
                  : 'border-parchment-300 bg-parchment-50 text-ink-700'
              }`}
              style={domainFilter === id ? { borderColor: d.color } : {}}
            >
              {d.short}
            </button>
          ))}
        </div>
      </header>

      {grouped.map(({ era, events }) => {
        if (events.length === 0) return null;
        return (
          <section key={era.id} className="mb-7">
            <h2 className="mb-1.5 border-b border-parchment-300 pb-1 font-serif text-base uppercase tracking-[0.18em] text-ink-700">
              {era.label}
            </h2>
            <p className="mb-2 font-serif text-[11px] italic text-ink-400">
              {formatYear(era.start)} – {formatYear(era.end)} · {events.length} events
            </p>
            <ul className="space-y-2">
              {events.map((n) => {
                const d = DOMAIN_BY_ID[n.raw.domain];
                return (
                  <li
                    key={n.raw.id}
                    className="rounded border border-parchment-300/60 bg-parchment-50 p-3 shadow-page"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: d.color }}
                      />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-serif text-base leading-tight text-ink-900">
                            {n.raw.label}
                          </h3>
                          <span className="font-sans text-[11px] text-ink-500">
                            {formatYear(n.year)}
                          </span>
                        </div>
                        <div
                          className="text-[10px] uppercase tracking-wider"
                          style={{ color: d.color }}
                        >
                          {d.label}
                        </div>
                        <p className="mt-1.5 font-serif text-[13.5px] leading-snug text-ink-700">
                          {n.raw.description}
                        </p>
                        {n.raw.keyFigures && n.raw.keyFigures.length > 0 && (
                          <div className="mt-1 font-serif text-[12px] italic text-ink-500">
                            {n.raw.keyFigures.join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <footer className="pt-4 text-center font-serif text-[11px] italic text-ink-400">
        Open on a larger screen to see the full interactive network.
      </footer>
    </div>
  );
}
