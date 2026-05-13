import type { UIActions, UIState } from '../hooks/useUIState';
import type { ViewId } from '../types';

interface ViewTabsProps {
  ui: UIState & UIActions;
}

const TABS: { id: ViewId; key: string; label: string; sub: string }[] = [
  { id: 'time', key: '1', label: 'Time-axis', sub: 'when things happened' },
  { id: 'geo', key: '2', label: 'Geographic', sub: 'where things happened' },
  { id: 'people', key: '3', label: 'People', sub: 'who connected to whom' },
  { id: 'concept', key: '4', label: 'Concepts', sub: 'ideas through time' },
];

export function ViewTabs({ ui }: ViewTabsProps) {
  return (
    <nav className="flex items-stretch gap-1 border-b border-parchment-300 bg-parchment-50/90 px-3 pt-1.5">
      {TABS.map((t) => {
        const active = ui.view === t.id;
        return (
          <button
            key={t.id}
            onClick={() => ui.setView(t.id)}
            className={`group relative flex items-baseline gap-2 rounded-t-md border border-b-0 px-3 py-1.5 font-serif text-sm transition-colors ${
              active
                ? 'border-parchment-300 bg-parchment-100 text-ink-900 shadow-page'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
            aria-pressed={active}
            aria-label={`Switch to ${t.label} view`}
          >
            <span className="text-[15px] tracking-wide">{t.label}</span>
            <span
              className={`hidden font-sans text-[10px] uppercase tracking-[0.16em] sm:inline ${
                active ? 'text-ink-500' : 'text-ink-400 group-hover:text-ink-500'
              }`}
            >
              {t.sub}
            </span>
            <span className="ml-1 rounded border border-parchment-300 px-1 font-sans text-[10px] text-ink-500">
              {t.key}
            </span>
            {active && (
              <span className="absolute -bottom-px left-0 right-0 h-px bg-parchment-100" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
