import { useMemo } from 'react';
import { useEvents } from './hooks/useEvents';
import { useUIState } from './hooks/useUIState';
import { useViewport } from './hooks/useResponsive';
import { TimelineNetwork } from './components/TimelineNetwork';
import { DetailPanel } from './components/DetailPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MobileFallback } from './components/MobileFallback';
import { parseEventYear } from './lib/timeScale';
import type { RawEdge, RawEvent } from './types';

export default function App() {
  const events = useEvents();
  const ui = useUIState();
  const vp = useViewport();

  const prepared = useMemo(() => prepareData(events), [events]);

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
  const { nodes, edges } = prepared;

  return (
    <div className="flex h-full flex-col bg-parchment-100">
      <Header
        nodeCount={nodes.length}
        edgeCount={edges.length}
        search={ui.search}
        onSearchChange={ui.setSearch}
      />
      <div className="relative flex flex-1 overflow-hidden">
        <ControlsPanel ui={ui} />
        <div className="relative flex-1 overflow-hidden">
          <TimelineNetwork nodes={nodes} edges={edges} ui={ui} />
          <Legend />
        </div>
        <DetailPanel nodes={nodes} edges={edges} ui={ui} />
      </div>
      <TimeScrubber ui={ui} nodes={nodes} />
    </div>
  );
}

function prepareData(state: ReturnType<typeof useEvents>) {
  if (state.status !== 'ready') return null;
  const { nodes: rawNodes, edges: rawEdges } = state.doc;
  const nodes: PreparedNode[] = rawNodes.map((n) => ({
    raw: n,
    year: parseEventYear(n.date),
  }));
  const idSet = new Set(nodes.map((n) => n.raw.id));
  const edges = rawEdges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
  return { nodes, edges };
}

export interface PreparedNode {
  raw: RawEvent;
  year: number;
}

export type PreparedEdge = RawEdge;
