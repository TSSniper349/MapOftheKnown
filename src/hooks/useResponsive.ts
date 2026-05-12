import { useEffect, useState, useRef, useCallback } from 'react';

export interface Viewport {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => measure());
  useEffect(() => {
    const onResize = () => setVp(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

function measure(): Viewport {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const h = typeof window === 'undefined' ? 800 : window.innerHeight;
  return {
    width: w,
    height: h,
    isMobile: w < 720,
    isTablet: w >= 720 && w < 1080,
  };
}

/**
 * Returns a callback ref + the observed size. On attach we take a synchronous
 * measurement (so the first render after mount already has real dimensions
 * instead of {0,0}), then subscribe to a ResizeObserver for ongoing updates.
 * Bails out of setSize when the dimensions haven't changed to avoid pointless
 * re-renders.
 */
export function useResizeObserver<T extends HTMLElement>(): [
  (el: T | null) => void,
  { width: number; height: number },
] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<T | null>(null);

  const update = useCallback((width: number, height: number) => {
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const setRef = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      elementRef.current = el;
      if (!el) return;
      // Synchronous initial measurement so layout doesn't have to wait a frame.
      const rect = el.getBoundingClientRect();
      update(rect.width, rect.height);
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        update(width, height);
      });
      ro.observe(el);
      observerRef.current = ro;
    },
    [update],
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  return [setRef, size];
}
