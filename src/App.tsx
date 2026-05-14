import { useEffect, useMemo } from 'react';
import { useEvents } from './hooks/useEvents';
import { usePeople } from './hooks/usePeople';
import { useUIState } from './hooks/useUIState';
import { useViewport } from './hooks/useResponsive';
import { TimelineNetwork } from './components/TimelineNetwork';
import { GeographicView } from './views/GeographicView';
import { PeopleView } from './views/PeopleView';
import { ConceptView } from './views/ConceptView';
import { DetailPanel } from './components/DetailPanel';
import { PersonProfilePanel } from './components/PersonProfilePanel';
import { ControlsPanel } from './components/ControlsPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { Header } from './components/Header';
import { ViewTabs } from './components/ViewTabs';
import { SelectionBreadcrumb } from './components/SelectionBreadcrumb';
import { MobileFallback } from './components/MobileFallback';
import { parseEventYear } from './lib/timeScale';
import { deriveTables } from './lib/derive';
import type { RawEdge, RawEvent, ViewId } from './types';

export default function App() {
  const events = useEvents();
  const profiles = usePeople();
  const ui = useUIState();
  const vp = useViewport();

  const prepared = useMemo(() => prepareData(events), [events]);

  /* ----- Global keyboard ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') ui.setView('time');
      else if (e.key === '2') ui.setView('geo');
      else if (e.key === '3') ui.setView('people');
      else if (e.key === '4') ui.setView('concept');
      else if (e.key === ' ' && ui.view === 'time') {
        e.preventDefault();
        ui.togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  if (events.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-ink-500">
        <div className="font-serif text-xl tracking-wide">Loading the map…</div>
      </div>
    );
  }
  if (events.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-ink-700">
        <div>
          <div className="font-serif text-2xl">Could not load events.json</div>
          <div className="mt-2 text-sm text-ink-500">{events.error}</div>
        </div>
      </div>
    );
  }

  if (vp.isMobile && prepared) {
    return <MobileFallback nodes={prepared.nodes} />;
  }

  if (!prepared) return null;
  const { nodes, edges, derived } = prepared;

  const showScrubber = ui.view === 'time' || ui.view === 'geo';

  return (
    <div className="flex h-full flex-col bg-parchment-100">
      <Header
        nodeCount={nodes.length}
        edgeCount={edges.length}
        search={ui.search}
        onSearchChange={ui.setSearch}
        onSubmitSearch={() => teleportFromSearch(nodes, ui)}
      />
      <ViewTabs ui={ui} />
      <div className="relative flex flex-1 overflow-hidden">
        <ControlsPanel ui={ui} />
        <div className="relative flex-1 overflow-hidden">
          <ViewCanvas
            view={ui.view}
            nodes={nodes}
            edges={edges}
            derived={derived}
            ui={ui}
          />
          <SelectionBreadcrumb nodes={nodes} edges={edges} ui={ui} />
        </div>
        {ui.selectedPerson ? (
          <PersonProfilePanel
            name={ui.selectedPerson}
            nodes={nodes}
            edges={edges}
            derived={derived}
            profile={profiles.get(ui.selectedPerson)}
            ui={ui}
          />
        ) : (
          <DetailPanel nodes={nodes} edges={edges} derived={derived} ui={ui} />
        )}
      </div>
      {showScrubber && <TimeScrubber ui={ui} nodes={nodes} />}
    </div>
  );
}

function ViewCanvas({
  view,
  nodes,
  edges,
  derived,
  ui,
}: {
  view: ViewId;
  nodes: PreparedNode[];
  edges: PreparedEdge[];
  derived: ReturnType<typeof deriveTables>;
  ui: ReturnType<typeof useUIState>;
}) {
  switch (view) {
    case 'time':
      return <TimelineNetwork nodes={nodes} edges={edges} ui={ui} />;
    case 'geo':
      return <GeographicView nodes={nodes} ui={ui} />;
    case 'people':
      return <PeopleView nodes={nodes} derived={derived} ui={ui} />;
    case 'concept':
      return <ConceptView nodes={nodes} derived={derived} ui={ui} />;
  }
}

function teleportFromSearch(nodes: PreparedNode[], ui: ReturnType<typeof useUIState>) {
  const q = ui.search.trim().toLowerCase();
  if (!q) return;
  // Prefer label-prefix matches, then label-contains, then any-field.
  const labelExact = nodes.find((n) => n.raw.label.toLowerCase() === q);
  const labelPrefix = nodes.find((n) => n.raw.label.toLowerCase().startsWith(q));
  const labelContains = nodes.find((n) => n.raw.label.toLowerCase().includes(q));
  const figureContains = nodes.find((n) =>
    (n.raw.keyFigures ?? []).some((f) => f.toLowerCase().includes(q)),
  );
  const conceptContains = nodes.find((n) =>
    (n.raw.concepts ?? []).some((c) => c.toLowerCase().includes(q)),
  );
  const found =
    labelExact ?? labelPrefix ?? labelContains ?? figureContains ?? conceptContains ?? null;
  if (found) ui.teleportTo(found.raw.id);
}

function prepareData(state: ReturnType<typeof useEvents>) {
  if (state.status !== 'ready') return null;
  const { nodes: rawNodes, edges: rawEdges } = state.doc;
  const nodes: PreparedNode[] = rawNodes.map((n) => ({
    raw: n,
    year: parseEventYear(n.date),
  }));
  const idSet = new Set(nodes.map((n) => n.raw.id));
  const edges = rawEdges
    .filter((e) => {
      const target = idSet.has(e.target);
      if (!target) return false;
      if (e.source) return idSet.has(e.source);
      if (e.sources) return e.sources.every((s) => idSet.has(s));
      return false;
    })
    .map((e) => normalizeEdge(e));
  const derived = deriveTables(rawNodes);
  return { nodes, edges, derived };
}

function normalizeEdge(e: RawEdge): PreparedEdge {
  // For `synthesizes` edges expressed via `sources: [a, b]`, surface the first
  // source as `source` (keeps the directed-graph machinery intact) and store
  // the second as `secondarySource`.
  if (e.source) {
    return {
      source: e.source,
      target: e.target,
      type: e.type,
      description: e.description,
    };
  }
  if (e.sources && e.sources.length >= 1) {
    return {
      source: e.sources[0],
      target: e.target,
      type: e.type,
      description: e.description,
      secondarySource: e.sources[1],
    };
  }
  // Should be filtered out before this point.
  return {
    source: e.target,
    target: e.target,
    type: e.type,
    description: e.description,
  };
}

export interface PreparedNode {
  raw: RawEvent;
  year: number;
}

export interface PreparedEdge {
  source: string;
  target: string;
  type: RawEdge['type'];
  description?: string;
  secondarySource?: string;
}
