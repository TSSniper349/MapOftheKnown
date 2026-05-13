import { useEffect, useRef } from 'react';

interface HeaderProps {
  nodeCount: number;
  edgeCount: number;
  search: string;
  onSearchChange: (s: string) => void;
  onSubmitSearch?: () => void;
}

export function Header({
  nodeCount,
  edgeCount,
  search,
  onSearchChange,
  onSubmitSearch,
}: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="flex items-center justify-between gap-6 border-b border-parchment-300 bg-parchment-50/90 px-6 py-3 shadow-page">
      <div className="flex items-baseline gap-4">
        <h1 className="font-serif text-2xl text-ink-900">Map of the Known</h1>
        <p className="hidden font-serif italic text-ink-500 lg:block">
          a time-axis network of human knowledge
        </p>
      </div>
      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="hidden text-xs uppercase tracking-wider text-ink-500 sm:block">
          {nodeCount.toLocaleString()} events &nbsp;&middot;&nbsp; {edgeCount.toLocaleString()}{' '}
          influences
        </div>
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch?.();
          }}
        >
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search · Enter to teleport"
            className="w-64 rounded-md border border-parchment-300 bg-parchment-50 px-3 py-1.5 font-serif text-sm text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
            type="search"
            aria-label="Search events, figures, and concepts"
          />
          {!search && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-parchment-300 px-1 text-[10px] uppercase tracking-wider text-ink-400">
              /
            </span>
          )}
        </form>
      </div>
    </header>
  );
}
