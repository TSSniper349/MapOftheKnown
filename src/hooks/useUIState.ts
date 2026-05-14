import { useCallback, useEffect, useRef, useState } from 'react';
import type { DomainId, ViewId } from '../types';
import { DOMAINS } from '../data/domains';
import { STORYLINE_BY_ID } from '../data/storylines';

export type TraceDepth = 1 | 2 | -1; // -1 = all
export type PlaySpeed = 30 | 80 | 200 | 500; // years per second

export interface UIState {
  view: ViewId;
  hoveredId: string | null;
  selectedId: string | null;
  selectedPerson: string | null;
  selectedConcept: string | null;
  compareIds: [string | null, string | null];
  traceActive: boolean;
  traceDepth: TraceDepth;
  visibleDomains: Set<DomainId>;
  importanceMin: 1 | 2 | 3 | 4 | 5;
  search: string;
  showEdges: boolean;
  yearWindow: [number, number] | null;
  detailPinned: boolean;
  playing: boolean;
  playSpeed: PlaySpeed;
  /** Highlight events with fewer than 2 edges (the "what's missing" lens). */
  highlightSparse: boolean;
  /** Show only frontier (ongoing research) events. */
  frontierOnly: boolean;
  /** Search-pulse target; used by the time-axis to flash a node briefly. */
  pulseId: string | null;
  /** Counter incremented when search teleports; views can react to this. */
  teleportCounter: number;
  /** Active storyline tour id; null when not running. */
  storylineId: string | null;
  /** Current step index inside the active storyline. */
  storylineStep: number;
  /** Whether the storyline auto-advances on a timer. */
  storylineAuto: boolean;
}

export interface UIActions {
  setView: (v: ViewId) => void;
  setHovered: (id: string | null) => void;
  selectNode: (id: string | null, shift?: boolean) => void;
  selectPerson: (name: string | null) => void;
  selectConcept: (id: string | null) => void;
  closeDetail: () => void;
  clearCompare: () => void;
  toggleTrace: () => void;
  setTraceDepth: (d: TraceDepth) => void;
  toggleDomain: (id: DomainId) => void;
  setAllDomains: (visible: boolean) => void;
  setImportanceMin: (n: 1 | 2 | 3 | 4 | 5) => void;
  setSearch: (s: string) => void;
  setShowEdges: (v: boolean) => void;
  setYearWindow: (w: [number, number] | null) => void;
  togglePinDetail: () => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  setPlaySpeed: (s: PlaySpeed) => void;
  toggleHighlightSparse: () => void;
  toggleFrontierOnly: () => void;
  resetFilters: () => void;
  triggerPulse: (id: string) => void;
  teleportTo: (id: string) => void;
  startStoryline: (id: string) => void;
  exitStoryline: () => void;
  setStorylineStep: (n: number) => void;
  nextStorylineStep: () => void;
  prevStorylineStep: () => void;
  toggleStorylineAuto: () => void;
}

export function useUIState(): UIState & UIActions {
  const [view, setViewState] = useState<ViewId>('time');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPersonState] = useState<string | null>(null);
  const [selectedConcept, setSelectedConceptState] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null]);
  const [traceActive, setTraceActive] = useState(false);
  const [traceDepth, setTraceDepth] = useState<TraceDepth>(-1);
  const [visibleDomains, setVisibleDomains] = useState<Set<DomainId>>(
    new Set(DOMAINS.map((d) => d.id)),
  );
  const [importanceMin, setImportanceMin] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [search, setSearch] = useState('');
  const [showEdges, setShowEdges] = useState(true);
  const [yearWindow, setYearWindow] = useState<[number, number] | null>(null);
  const [detailPinned, setDetailPinned] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>(80);
  const [highlightSparse, setHighlightSparse] = useState(false);
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [teleportCounter, setTeleportCounter] = useState(0);
  const [storylineId, setStorylineId] = useState<string | null>(null);
  const [storylineStep, setStorylineStepState] = useState(0);
  const [storylineAuto, setStorylineAuto] = useState(false);

  const pulseTimeout = useRef<number | null>(null);

  const setView = useCallback((v: ViewId) => {
    setViewState(v);
  }, []);

  const selectNode = useCallback((id: string | null, shift?: boolean) => {
    if (id === null) {
      setSelectedId(null);
      return;
    }
    if (shift) {
      setCompareIds(([a, b]) => {
        if (id === a || id === b) return [a, b];
        if (a && !b) return [a, id];
        return [id, null];
      });
      setSelectedId(id);
      setSelectedPersonState(null);
      return;
    }
    setCompareIds([null, null]);
    setSelectedId(id);
    setSelectedPersonState(null);
  }, []);

  const selectPerson = useCallback((name: string | null) => {
    setSelectedPersonState(name);
    if (name) {
      setSelectedId(null);
      setCompareIds([null, null]);
    }
  }, []);

  const selectConcept = useCallback((id: string | null) => {
    setSelectedConceptState(id);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setCompareIds([null, null]);
    setTraceActive(false);
    setDetailPinned(false);
  }, []);

  const clearCompare = useCallback(() => setCompareIds([null, null]), []);
  const toggleTrace = useCallback(() => setTraceActive((v) => !v), []);

  const toggleDomain = useCallback((id: DomainId) => {
    setVisibleDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllDomains = useCallback((visible: boolean) => {
    setVisibleDomains(visible ? new Set(DOMAINS.map((d) => d.id)) : new Set());
  }, []);

  const togglePinDetail = useCallback(() => setDetailPinned((v) => !v), []);
  const togglePlay = useCallback(() => setPlaying((v) => !v), []);
  const toggleHighlightSparse = useCallback(() => setHighlightSparse((v) => !v), []);
  const toggleFrontierOnly = useCallback(() => setFrontierOnly((v) => !v), []);
  const resetFilters = useCallback(() => {
    setVisibleDomains(new Set(DOMAINS.map((d) => d.id)));
    setImportanceMin(1);
    setSearch('');
    setShowEdges(true);
    setYearWindow(null);
    setHighlightSparse(false);
    setFrontierOnly(false);
    setSelectedPersonState(null);
    setSelectedConceptState(null);
  }, []);

  const triggerPulse = useCallback((id: string) => {
    setPulseId(id);
    if (pulseTimeout.current) window.clearTimeout(pulseTimeout.current);
    pulseTimeout.current = window.setTimeout(() => setPulseId(null), 1500);
  }, []);

  const teleportTo = useCallback(
    (id: string) => {
      setSelectedId(id);
      setCompareIds([null, null]);
      setTeleportCounter((n) => n + 1);
      triggerPulse(id);
      setViewState('time');
    },
    [triggerPulse],
  );

  useEffect(
    () => () => {
      if (pulseTimeout.current) window.clearTimeout(pulseTimeout.current);
    },
    [],
  );

  const startStoryline = useCallback((id: string) => {
    if (!STORYLINE_BY_ID.has(id)) return;
    setStorylineId(id);
    setStorylineStepState(0);
    setStorylineAuto(false);
    setViewState('time');
    setPlaying(false);
  }, []);

  const exitStoryline = useCallback(() => {
    setStorylineId(null);
    setStorylineStepState(0);
    setStorylineAuto(false);
  }, []);

  const setStorylineStep = useCallback((n: number) => {
    setStorylineStepState((cur) => {
      const sl = storylineId ? STORYLINE_BY_ID.get(storylineId) : null;
      if (!sl) return cur;
      return Math.max(0, Math.min(sl.steps.length - 1, n));
    });
  }, [storylineId]);

  const nextStorylineStep = useCallback(() => {
    setStorylineStepState((cur) => {
      const sl = storylineId ? STORYLINE_BY_ID.get(storylineId) : null;
      if (!sl) return cur;
      return Math.min(sl.steps.length - 1, cur + 1);
    });
  }, [storylineId]);

  const prevStorylineStep = useCallback(() => {
    setStorylineStepState((cur) => Math.max(0, cur - 1));
  }, []);

  const toggleStorylineAuto = useCallback(() => setStorylineAuto((v) => !v), []);

  return {
    view,
    hoveredId,
    selectedId,
    selectedPerson,
    selectedConcept,
    compareIds,
    traceActive,
    traceDepth,
    visibleDomains,
    importanceMin,
    search,
    showEdges,
    yearWindow,
    detailPinned,
    playing,
    playSpeed,
    highlightSparse,
    frontierOnly,
    pulseId,
    teleportCounter,
    setView,
    setHovered: setHoveredId,
    selectNode,
    selectPerson,
    selectConcept,
    closeDetail,
    clearCompare,
    toggleTrace,
    setTraceDepth,
    toggleDomain,
    setAllDomains,
    setImportanceMin,
    setSearch,
    setShowEdges,
    setYearWindow,
    togglePinDetail,
    togglePlay,
    setPlaying,
    setPlaySpeed,
    toggleHighlightSparse,
    toggleFrontierOnly,
    resetFilters,
    triggerPulse,
    teleportTo,
    storylineId,
    storylineStep,
    storylineAuto,
    startStoryline,
    exitStoryline,
    setStorylineStep,
    nextStorylineStep,
    prevStorylineStep,
    toggleStorylineAuto,
  };
}
