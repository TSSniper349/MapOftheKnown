import { DOMAINS } from '../data/domains';

export function Legend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 hidden flex-col items-end gap-1 rounded-md border border-parchment-300 bg-parchment-50/85 px-3 py-2 text-[11px] shadow-page xl:flex">
      <div className="font-serif uppercase tracking-[0.16em] text-ink-500">Domains</div>
      {DOMAINS.map((d) => (
        <div key={d.id} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
          <span className="font-serif text-ink-700">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
