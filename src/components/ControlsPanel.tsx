import { useState } from 'react';
import type { UIActions, UIState } from '../hooks/useUIState';
import { DOMAINS } from '../data/domains';
import { StorylinePicker } from './StorylineRunner';

interface ControlsPanelProps {
  ui: UIState & UIActions;
}

export function ControlsPanel({ ui }: ControlsPanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <aside
      className={`group/controls relative flex shrink-0 flex-col overflow-hidden border-r border-parchment-300 bg-parchment-50/60 transition-[width,padding] duration-200 ease-out ${
        open
          ? 'w-64 px-4 py-4 hover:w-72'
          : 'w-9 px-0 py-2 hover:w-12 hover:bg-parchment-100/80'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-1.5 top-1.5 rounded p-1 text-ink-500 hover:bg-parchment-200/70 hover:text-ink-700"
        aria-label={open ? 'Collapse controls' : 'Expand controls'}
        title={open ? 'Collapse' : 'Expand'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {open ? (
            <path d="M9 3 L5 7 L9 11" stroke="currentColor" strokeWidth="1.5" />
          ) : (
            <path d="M5 3 L9 7 L5 11" stroke="currentColor" strokeWidth="1.5" />
          )}
        </svg>
      </button>

      {!open ? (
        <div className="mt-8 origin-top-left -rotate-90 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ink-500">
          controls
        </div>
      ) : (
        <>
          <div className="mb-3 mt-1 flex items-baseline justify-between">
            <h3 className="font-serif text-sm uppercase tracking-[0.16em] text-ink-600">
              Controls
            </h3>
          </div>

          <Section title="Domains">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-ink-500">
                <button
                  type="button"
                  className="hover:text-ink-700"
                  onClick={() => ui.setAllDomains(true)}
                >
                  show all
                </button>
                <span>·</span>
                <button
                  type="button"
                  className="hover:text-ink-700"
                  onClick={() => ui.setAllDomains(false)}
                >
                  hide all
                </button>
              </div>
              {DOMAINS.map((d) => {
                const on = ui.visibleDomains.has(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-parchment-200/60"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-sm border"
                      style={{
                        background: on ? d.color : 'transparent',
                        borderColor: d.color,
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => ui.toggleDomain(d.id)}
                      className="sr-only"
                      aria-label={`${d.label}`}
                    />
                    <span
                      className={`font-serif text-[13px] ${on ? 'text-ink-800' : 'text-ink-400 line-through'}`}
                    >
                      {d.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>

          <Section title="Importance">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                value={ui.importanceMin}
                onChange={(e) =>
                  ui.setImportanceMin(Math.min(5, Math.max(1, Number(e.target.value))) as 1 | 2 | 3 | 4 | 5)
                }
                className="flex-1"
                aria-label="Importance threshold"
              />
              <span className="font-serif text-sm tabular-nums text-ink-700">
                ≥ {ui.importanceMin}
              </span>
            </div>
            <div className="mt-1 font-serif text-[11px] italic text-ink-400">
              show events at this importance or higher
            </div>
          </Section>

          <Section title="Edges">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ui.showEdges}
                onChange={(e) => ui.setShowEdges(e.target.checked)}
                className="h-3 w-3 accent-ink-700"
              />
              <span className="font-serif text-[13px] text-ink-800">
                show influence edges
              </span>
            </label>
            <p className="mt-1 font-serif text-[11px] italic text-ink-400">
              edges fade to ~10%; brighten on hover/selection
            </p>
          </Section>

          <Section title="Storylines">
            <p className="mb-1.5 font-serif text-[11px] italic text-ink-500">
              curated tours through the influence graph
            </p>
            <StorylinePicker ui={ui} />
          </Section>

          <Section title="Lenses">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ui.frontierOnly}
                onChange={ui.toggleFrontierOnly}
                className="h-3 w-3 accent-ink-700"
              />
              <span className="font-serif text-[13px] text-ink-800">
                frontier only (active research)
              </span>
            </label>
            <label className="mt-1 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ui.highlightSparse}
                onChange={ui.toggleHighlightSparse}
                className="h-3 w-3 accent-ink-700"
              />
              <span className="font-serif text-[13px] text-ink-800">
                highlight sparse events
              </span>
            </label>
            <p className="mt-1 font-serif text-[11px] italic text-ink-400">
              ringed events have fewer than 2 edges &mdash; curation gaps
            </p>
            <button
              type="button"
              onClick={ui.resetFilters}
              className="mt-2 w-full rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-700 hover:bg-parchment-200"
            >
              reset all filters
            </button>
          </Section>

          <Section title="Legend">
            <div className="space-y-1.5 font-serif text-[12.5px] text-ink-700">
              <LegendRow label="enables (foundational)">
                <svg width="40" height="10">
                  <line x1={2} y1={5} x2={32} y2={5} stroke="#574c39" strokeWidth={1.2} />
                  <path d="M32 5 L26 2 L26 8 z" fill="#574c39" />
                </svg>
              </LegendRow>
              <LegendRow label="influences (conceptual)">
                <svg width="40" height="10">
                  <line
                    x1={2}
                    y1={5}
                    x2={38}
                    y2={5}
                    stroke="#574c39"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </svg>
              </LegendRow>
              <LegendRow label="refines (succession)">
                <svg width="40" height="10">
                  <line x1={2} y1={5} x2={30} y2={5} stroke="#574c39" strokeWidth={1.2} />
                  <path d="M30 5 L24 1 L24 9 L28 5 z" fill="#574c39" />
                </svg>
              </LegendRow>
              <LegendRow label="frontier (active research)">
                <svg width="20" height="14">
                  <circle
                    cx={10}
                    cy={7}
                    r={5}
                    fill="#3F5E3C"
                    stroke="#7a2e3a"
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                  />
                </svg>
              </LegendRow>
            </div>
          </Section>

          <p className="mt-auto pt-4 font-serif text-[11px] italic text-ink-400">
            v0.1 · {DOMAINS.length} lanes · curated, not exhaustive.
          </p>
        </>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function LegendRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-block w-10">{children}</span>
      <span>{label}</span>
    </div>
  );
}
