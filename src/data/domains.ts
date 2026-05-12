import type { DomainConfig, DomainId, Era } from '../types';

export const DOMAINS: DomainConfig[] = [
  {
    id: 'language',
    label: 'Language & Communication',
    short: 'Language',
    color: '#3B5A7A',
    laneTint: 'rgba(59,90,122,0.04)',
  },
  {
    id: 'math',
    label: 'Mathematics & Logic',
    short: 'Math',
    color: '#8C4A3E',
    laneTint: 'rgba(140,74,62,0.04)',
  },
  {
    id: 'philosophy',
    label: 'Philosophy',
    short: 'Philosophy',
    color: '#5C4F7A',
    laneTint: 'rgba(92,79,122,0.04)',
  },
  {
    id: 'physics',
    label: 'Physics & Astronomy',
    short: 'Physics',
    color: '#1F3D5A',
    laneTint: 'rgba(31,61,90,0.04)',
  },
  {
    id: 'chemistry',
    label: 'Chemistry & Materials',
    short: 'Chemistry',
    color: '#7A5C2E',
    laneTint: 'rgba(122,92,46,0.04)',
  },
  {
    id: 'life_sciences',
    label: 'Life Sciences',
    short: 'Life Sci.',
    color: '#3F5E3C',
    laneTint: 'rgba(63,94,60,0.04)',
  },
  {
    id: 'medicine',
    label: 'Medicine & Health',
    short: 'Medicine',
    color: '#7A2E3A',
    laneTint: 'rgba(122,46,58,0.04)',
  },
  {
    id: 'earth_sciences',
    label: 'Earth & Environment',
    short: 'Earth Sci.',
    color: '#4E6B5A',
    laneTint: 'rgba(78,107,90,0.04)',
  },
  {
    id: 'social_sciences',
    label: 'Social Sciences',
    short: 'Social Sci.',
    color: '#8A6B3E',
    laneTint: 'rgba(138,107,62,0.04)',
  },
  {
    id: 'cs',
    label: 'Computer & Information',
    short: 'CS / Info',
    color: '#2E5C5C',
    laneTint: 'rgba(46,92,92,0.04)',
  },
  {
    id: 'engineering',
    label: 'Engineering & Applied',
    short: 'Engineering',
    color: '#5A4632',
    laneTint: 'rgba(90,70,50,0.04)',
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
