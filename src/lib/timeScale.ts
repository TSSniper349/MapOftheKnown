import { ERAS } from '../data/domains';
import type { Era } from '../types';

export function parseEventYear(date: number | string): number {
  if (typeof date === 'number') return date;
  const m = date.match(/^(-?\d+)(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return Number(date) || 0;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 0;
  const d = m[3] ? Number(m[3]) : 0;
  return y + (mo - 1) / 12 + d / 365;
}

/**
 * Piecewise linear "era-compressed" time scale.
 * Each era owns a fixed slice of the x-axis at default zoom (sum of shares = 1).
 * Linear within each era so events keep their relative ordering and proportional spacing inside the era.
 */
export interface EraScale {
  domain: [number, number];
  range: [number, number];
  forward: (year: number) => number;
  inverse: (px: number) => number;
  eras: Era[];
  eraBounds: { era: Era; x0: number; x1: number }[];
}

export function createEraScale(rangeStart: number, rangeEnd: number, eras: Era[] = ERAS): EraScale {
  const totalShare = eras.reduce((s, e) => s + e.share, 0);
  const width = rangeEnd - rangeStart;
  const eraBounds: { era: Era; x0: number; x1: number }[] = [];
  let cursor = rangeStart;
  for (const era of eras) {
    const w = (era.share / totalShare) * width;
    eraBounds.push({ era, x0: cursor, x1: cursor + w });
    cursor += w;
  }
  const domain: [number, number] = [eras[0].start, eras[eras.length - 1].end];

  const forward = (year: number): number => {
    if (year <= eras[0].start) {
      return rangeStart;
    }
    if (year >= eras[eras.length - 1].end) {
      return rangeEnd;
    }
    for (const { era, x0, x1 } of eraBounds) {
      if (year >= era.start && year <= era.end) {
        const t = (year - era.start) / (era.end - era.start);
        return x0 + t * (x1 - x0);
      }
    }
    return rangeStart;
  };

  const inverse = (px: number): number => {
    if (px <= rangeStart) return eras[0].start;
    if (px >= rangeEnd) return eras[eras.length - 1].end;
    for (const { era, x0, x1 } of eraBounds) {
      if (px >= x0 && px <= x1) {
        const t = (px - x0) / (x1 - x0);
        return era.start + t * (era.end - era.start);
      }
    }
    return eras[0].start;
  };

  return { domain, range: [rangeStart, rangeEnd], forward, inverse, eras, eraBounds };
}

export function eraForYear(year: number, eras: Era[] = ERAS): Era {
  for (const e of eras) {
    if (year >= e.start && year <= e.end) return e;
  }
  if (year < eras[0].start) return eras[0];
  return eras[eras.length - 1];
}

export function formatYear(year: number): string {
  if (year <= -10000) {
    const k = Math.round(-year / 1000);
    return `${k.toLocaleString()} kya`;
  }
  if (year < 0) {
    return `${Math.round(-year).toLocaleString()} BCE`;
  }
  if (year < 1000) {
    return `${Math.round(year)} CE`;
  }
  return `${Math.round(year)}`;
}

/** Pick year tick positions for an axis (not used heavily; era boundaries do most of the work). */
export function eraTicks(): number[] {
  return ERAS.flatMap((e) => [e.start, e.end])
    .filter((y, i, arr) => arr.indexOf(y) === i)
    .sort((a, b) => a - b);
}

/** Useful named landmark years for orientation labels inside lanes. */
export const LANDMARK_YEARS = [
  -100000, -10000, -3000, -500, 0, 500, 1000, 1500, 1700, 1800, 1900, 1950, 2000, 2026,
];
