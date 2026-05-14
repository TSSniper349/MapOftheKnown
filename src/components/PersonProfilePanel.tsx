import { useMemo, useState } from 'react';
import type { PreparedEdge, PreparedNode } from '../App';
import { DOMAIN_BY_ID, DOMAINS } from '../data/domains';
import type { UIActions, UIState } from '../hooks/useUIState';
import type { DerivedTables, PersonInfluence } from '../lib/derive';
import { getPersonInfluence } from '../lib/derive';
import { formatYear } from '../lib/timeScale';
import type { PersonProfile } from '../hooks/usePeople';
import type { DomainId } from '../types';

interface PersonProfilePanelProps {
  name: string;
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  derived: DerivedTables;
  profile?: PersonProfile;
  ui: UIState & UIActions;
}

export function PersonProfilePanel({
  name,
  nodes,
  edges,
  derived,
  profile,
  ui,
}: PersonProfilePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [portraitError, setPortraitError] = useState(false);

  const record = derived.people.get(name);

  const events = useMemo(() => {
    if (!record) return [] as PreparedNode[];
    return record.events
      .map((id) => nodes.find((n) => n.raw.id === id))
      .filter((n): n is PreparedNode => !!n)
      .sort((a, b) => a.year - b.year);
  }, [record, nodes]);

  const influence = useMemo(() => {
    return getPersonInfluence(
      name,
      nodes.map((n) => n.raw),
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        description: e.description,
      })),
    );
  }, [name, nodes, edges]);

  if (!record) {
    return (
      <aside className="relative flex h-full w-[28rem] shrink-0 flex-col border-l border-parchment-300 bg-parchment-50/60 px-6 py-8 text-ink-500">
        <div className="font-serif text-lg italic">
          No events on record for <span className="text-ink-700">{name}</span>.
        </div>
        <button
          type="button"
          onClick={() => ui.selectPerson(null)}
          className="mt-4 w-fit rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
        >
          close
        </button>
      </aside>
    );
  }

  if (collapsed) {
    return (
      <aside className="group/profile relative hidden h-full w-10 shrink-0 flex-col items-center border-l border-parchment-300 bg-parchment-50/70 py-3 transition-[width] duration-200 ease-out hover:w-14 hover:bg-parchment-50 lg:flex">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-ink-500 hover:bg-parchment-200/70 hover:text-ink-700"
          aria-label="Expand profile"
          title="Expand"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3 L5 7 L9 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="mt-6 origin-top-left rotate-90 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ink-500">
          profile
        </div>
      </aside>
    );
  }

  const primary = DOMAIN_BY_ID[record.primaryDomain];
  const totalEvents = events.length;
  const lifeRange = profile?.life ?? `${formatYear(record.dateMin)} – ${formatYear(record.dateMax)}`;
  const tagline = profile?.tagline;
  const bio = profile?.bio;
  const portrait = profile?.portrait;

  const domainBreakdown: { id: DomainId; count: number; color: string; label: string }[] =
    DOMAINS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      count: record.domains.get(d.id) ?? 0,
    }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

  return (
    <aside className="group/profile relative flex h-full w-[28rem] shrink-0 flex-col border-l border-parchment-300 bg-parchment-50 shadow-card transition-[width] duration-200 ease-out hover:w-[31rem]">
      {/* Top ribbon: portrait + identity */}
      <div
        className="relative shrink-0 border-b border-parchment-300 px-6 pb-4 pt-6"
        style={{
          background: `linear-gradient(180deg, ${primary.laneTint} 0%, rgba(250,247,242,0) 100%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <Portrait
            portrait={portrait}
            failed={portraitError}
            onError={() => setPortraitError(true)}
            name={name}
            color={primary.color}
          />
          <div className="min-w-0 flex-1">
            <div
              className="text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ color: primary.color }}
            >
              {primary.label}
            </div>
            <h2 className="mt-0.5 font-serif text-[26px] leading-tight text-ink-900">{name}</h2>
            <div className="mt-1 font-serif text-[13px] italic text-ink-500">{lifeRange}</div>
            {tagline && (
              <div className="mt-1 font-serif text-[12.5px] text-ink-600">{tagline}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-md border border-parchment-300 bg-parchment-50/80 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
              title="Collapse"
            >
              collapse
            </button>
            <button
              type="button"
              onClick={() => ui.selectPerson(null)}
              className="rounded-md border border-parchment-300 bg-parchment-50/80 px-2 py-1 font-sans text-xs text-ink-600 hover:bg-parchment-200"
              aria-label="Close profile"
            >
              close
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-4 flex items-center gap-4 font-serif text-[12.5px] text-ink-600">
          <Stat label="events" value={totalEvents.toString()} />
          <Stat label="span" value={`${formatYear(record.dateMin)} → ${formatYear(record.dateMax)}`} />
          <Stat label="weight" value={record.totalImportance.toString()} />
        </div>
      </div>

      <div className="scroll-soft flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {bio && (
          <p className="drop-cap font-serif text-[15px] leading-relaxed text-ink-700">{bio}</p>
        )}

        {domainBreakdown.length > 1 && (
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Domains</div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-sm bg-parchment-200/60">
              {domainBreakdown.map((d) => (
                <div
                  key={d.id}
                  className="h-full"
                  style={{
                    width: `${(d.count / totalEvents) * 100}%`,
                    background: d.color,
                  }}
                  title={`${d.label}: ${d.count}`}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-serif text-[11.5px] text-ink-500">
              {domainBreakdown.map((d) => (
                <span key={d.id} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: d.color }}
                  />
                  {d.label}
                  <span className="font-sans tabular-nums text-ink-400">·{d.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <InfluenceSection
          title="Built on"
          subtitle="figures whose work feeds in"
          items={influence.builtOn}
          ui={ui}
          accent={primary.color}
          empty="No incoming influences in the current graph."
        />
        <InfluenceSection
          title="Enabled"
          subtitle="figures whose work flowed downstream"
          items={influence.enabled}
          ui={ui}
          accent={primary.color}
          empty="No downstream influences in the current graph."
        />
        <InfluenceSection
          title="Collaborators"
          subtitle="co-authors on the same events"
          items={influence.collaborators}
          ui={ui}
          accent={primary.color}
          empty="No co-authored events on record."
        />

        <div className="mt-6 border-t border-parchment-300/80 pt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">
              Major contributions
            </div>
            <div className="font-sans text-[10px] text-ink-400">{events.length}</div>
          </div>
          <ol className="relative mt-3 space-y-2 border-l border-parchment-300 pl-5">
            {events.map((n) => {
              const d = DOMAIN_BY_ID[n.raw.domain];
              return (
                <li key={n.raw.id} className="relative">
                  <span
                    className="absolute -left-[26px] top-2 h-3 w-3 rounded-full border-2 border-parchment-50"
                    style={{ background: d.color }}
                  />
                  <button
                    type="button"
                    onClick={() => ui.teleportTo(n.raw.id)}
                    className="w-full rounded-md border border-parchment-300/60 bg-parchment-50 px-3 py-2 text-left transition-colors hover:bg-parchment-200/60"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-serif text-[14px] leading-tight text-ink-900">
                        {n.raw.label}
                      </div>
                      <div className="font-sans text-[11px] text-ink-500">
                        {formatYear(n.year)}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: d.color }}>
                      {d.label}
                      {n.raw.frontier && (
                        <span className="ml-2 text-domain-medicine">· active</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {profile?.wikiTitle && (
          <a
            href={`https://en.wikipedia.org/wiki/${profile.wikiTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1 font-serif text-[12px] italic text-ink-500 underline decoration-parchment-300 underline-offset-2 hover:text-ink-700"
          >
            Read more on Wikipedia →
          </a>
        )}

        <p className="mt-6 border-t border-parchment-300 pt-3 font-serif text-[11px] italic text-ink-400">
          Influence links derived from event-level edges; click any related figure to open their
          profile.
        </p>
      </div>
    </aside>
  );
}

interface PortraitProps {
  portrait?: string;
  failed: boolean;
  onError: () => void;
  name: string;
  color: string;
}

function Portrait({ portrait, failed, onError, name, color }: PortraitProps) {
  const showImg = portrait && !failed;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <div className="relative shrink-0">
      <div
        className="relative h-20 w-20 overflow-hidden rounded-md border border-parchment-300 bg-parchment-100 shadow-card"
        style={{ boxShadow: `0 1px 6px ${color}22, inset 0 0 0 1px rgba(255,255,255,0.4)` }}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt={`Portrait of ${name}`}
            loading="lazy"
            onError={onError}
            className="h-full w-full object-cover"
            style={{ filter: 'sepia(0.18) saturate(0.92) contrast(1.02)' }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-serif text-2xl"
            style={{ color, background: `${color}14` }}
          >
            {initials}
          </div>
        )}
      </div>
      {/* Corner frame flourish */}
      <span
        className="pointer-events-none absolute -inset-0.5 rounded-md"
        style={{ boxShadow: `0 0 0 1px ${color}33` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
      <div className="font-serif tabular-nums text-ink-800">{value}</div>
    </div>
  );
}

interface InfluenceSectionProps {
  title: string;
  subtitle: string;
  items: PersonInfluence[];
  ui: UIState & UIActions;
  accent: string;
  empty: string;
}

function InfluenceSection({ title, subtitle, items, ui, accent, empty }: InfluenceSectionProps) {
  return (
    <div className="mt-5 border-t border-parchment-300/80 pt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{title}</div>
          <div className="font-serif text-[11.5px] italic text-ink-400">{subtitle}</div>
        </div>
        <div className="font-sans text-[10px] text-ink-400">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 font-serif text-[12.5px] italic text-ink-400">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.slice(0, 16).map((p) => (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => ui.selectPerson(p.name)}
                className="group/influence flex items-center gap-1.5 rounded-full border bg-parchment-50 px-2.5 py-1 font-serif text-[12.5px] text-ink-800 transition-colors hover:bg-parchment-200/70"
                style={{ borderColor: `${accent}33` }}
                title={`${p.weight} link${p.weight > 1 ? 's' : ''}`}
              >
                <span>{p.name}</span>
                {p.weight > 1 && (
                  <span className="font-sans text-[10px] tabular-nums text-ink-400 group-hover/influence:text-ink-600">
                    ×{p.weight}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
