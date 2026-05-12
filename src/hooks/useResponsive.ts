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

export function useResizeObserver<T extends HTMLElement>(): [
  (el: T | null) => void,
  { width: number; height: number },
] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const setRef = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const { width, height } = e.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    observerRef.current = ro;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  return [setRef, size];
}
