import { useCallback, useState } from 'react';
import type { DomainId } from '../types';
import { DOMAINS } from '../data/domains';

export type TraceDepth = 1 | 2 | -1; // -1 = all

export interface UIState {
  hoveredId: string | null;
  selectedId: string | null;
  compareIds: [string | null, string | null];
  traceActive: boolean;
  traceDepth: TraceDepth;
  visibleDomains: Set<DomainId>;
  importanceMin: 1 | 2 | 3 | 4 | 5;
  search: string;
  showEdges: boolean;
  yearWindow: [number, number] | null; // null = full
}

export interface UIActions {
  setHovered: (id: string | null) => void;
  selectNode: (id: string | null, shift?: boolean) => void;
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
}

export function useUIState(): UIState & UIActions {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      return;
    }
    setCompareIds([null, null]);
    setSelectedId(id);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setCompareIds([null, null]);
    setTraceActive(false);
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

  return {
    hoveredId,
    selectedId,
    compareIds,
    traceActive,
    traceDepth,
    visibleDomains,
    importanceMin,
    search,
    showEdges,
    yearWindow,
    setHovered: setHoveredId,
    selectNode,
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
  };
}
