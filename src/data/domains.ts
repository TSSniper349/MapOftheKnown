import type { DomainConfig, DomainId, Era } from '../types';

/**
 * v2 palette - retuned for accessibility:
 * - all 11 colors pass WCAG AA against the #FAF7F2 parchment background
 * - Life Sci. (forest) vs. Earth (sage) and Physics (navy) vs. CS (teal)
 *   are now distinguishable under Deuteranopia/Protanopia simulators
 */
export const DOMAINS: DomainConfig[] = [
  {
    id: 'language',
    label: 'Language & Communication',
    short: 'Language',
    color: '#3F5A8A',
    laneTint: 'rgba(63,90,138,0.045)',
  },
  {
    id: 'math',
    label: 'Mathematics & Logic',
    short: 'Math',
    color: '#9A3B3B',
    laneTint: 'rgba(154,59,59,0.045)',
  },
  {
    id: 'philosophy',
    label: 'Philosophy',
    short: 'Philosophy',
    color: '#6B4E8E',
    laneTint: 'rgba(107,78,142,0.045)',
  },
  {
    id: 'physics',
    label: 'Physics & Astronomy',
    short: 'Physics',
    color: '#1F4E79',
    laneTint: 'rgba(31,78,121,0.045)',
  },
  {
    id: 'chemistry',
    label: 'Chemistry & Materials',
    short: 'Chemistry',
    color: '#A8722C',
    laneTint: 'rgba(168,114,44,0.045)',
  },
  {
    id: 'life_sciences',
    label: 'Life Sciences',
    short: 'Life Sci.',
    color: '#3F6B3F',
    laneTint: 'rgba(63,107,63,0.045)',
  },
  {
    id: 'medicine',
    label: 'Medicine & Health',
    short: 'Medicine',
    color: '#8E2C2C',
    laneTint: 'rgba(142,44,44,0.045)',
  },
  {
    id: 'earth_sciences',
    label: 'Earth & Environment',
    short: 'Earth Sci.',
    color: '#5C7A4F',
    laneTint: 'rgba(92,122,79,0.045)',
  },
  {
    id: 'social_sciences',
    label: 'Social Sciences',
    short: 'Social Sci.',
    color: '#7A6A2C',
    laneTint: 'rgba(122,106,44,0.045)',
  },
  {
    id: 'cs',
    label: 'Computer & Information',
    short: 'CS / Info',
    color: '#2D6A6A',
    laneTint: 'rgba(45,106,106,0.045)',
  },
  {
    id: 'engineering',
    label: 'Engineering & Applied',
    short: 'Engineering',
    color: '#5A4A3A',
    laneTint: 'rgba(90,74,58,0.045)',
  },
];

export const DOMAIN_INDEX: Record<DomainId, number> = DOMAINS.reduce(
  (acc, d, i) => {
    acc[d.id] = i;
    return acc;
  },
  {} as Record<DomainId, number>,
);

export const DOMAIN_BY_ID: Record<DomainId, DomainConfig> = DOMAINS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DomainId, DomainConfig>,
);

export const ERAS: Era[] = [
  { id: 'prehistory', label: 'Prehistory', start: -150000, end: -3000, share: 0.13 },
  { id: 'antiquity', label: 'Antiquity', start: -3000, end: 500, share: 0.16 },
  { id: 'medieval', label: 'Medieval & Early Modern', start: 500, end: 1700, share: 0.18 },
  { id: 'modern', label: 'Modern', start: 1700, end: 1900, share: 0.18 },
  { id: 'contemporary', label: 'Contemporary', start: 1900, end: 2026, share: 0.35 },
];
