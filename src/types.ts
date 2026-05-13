export type DomainId =
  | 'language'
  | 'math'
  | 'philosophy'
  | 'physics'
  | 'chemistry'
  | 'life_sciences'
  | 'medicine'
  | 'earth_sciences'
  | 'social_sciences'
  | 'cs'
  | 'engineering';

export type EdgeType = 'enables' | 'influences' | 'refines' | 'synthesizes' | 'parallel';

export interface Location {
  label: string;
  lat: number;
  lon: number;
}

export interface RawEvent {
  id: string;
  label: string;
  date: number | string;
  dateUncertainty?: number;
  domain: DomainId;
  subdomain?: string;
  description: string;
  keyFigures?: string[];
  locations?: Location[];
  concepts?: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  frontier?: boolean;
  sources?: string[];
}

/**
 * Edge schema supports two source shapes:
 *   - `source: "evt_a"` for single-source edges
 *   - `sources: ["evt_a", "evt_b"]` for `synthesizes` edges that combine two priors
 */
export interface RawEdge {
  source?: string;
  sources?: string[];
  target: string;
  type: EdgeType;
  description?: string;
}

export interface EventNode extends Omit<RawEvent, 'date'> {
  year: number;
  rawDate: number | string;
  laneIndex: number;
  x: number;
  y: number;
  radius: number;
}

export interface EdgeLink {
  source: EventNode;
  target: EventNode;
  /** Present for `synthesizes` edges that have a second source. */
  secondarySource?: EventNode;
  type: EdgeType;
  description?: string;
}

export interface EventsDocument {
  _meta?: {
    version?: string;
    description?: string;
    domains?: DomainId[];
    [key: string]: unknown;
  };
  nodes: RawEvent[];
  edges: RawEdge[];
}

export interface DomainConfig {
  id: DomainId;
  label: string;
  short: string;
  color: string;
  laneTint: string;
}

export interface Era {
  id: string;
  label: string;
  start: number;
  end: number;
  /** Fraction of total x-axis width allocated to this era at default zoom. */
  share: number;
}

/* ----- Derived tables (computed at load time) ----- */

export interface PersonRecord {
  name: string;
  events: string[];
  totalImportance: number;
  domains: Map<DomainId, number>;
  primaryDomain: DomainId;
  dateMin: number;
  dateMax: number;
}

export interface PlaceRecord {
  key: string;
  label: string;
  lat: number;
  lon: number;
  events: string[];
}

export interface ConceptRecord {
  id: string;
  events: string[];
  domains: Map<DomainId, number>;
  dateMin: number;
  dateMax: number;
  frontier: boolean;
}

export type ViewId = 'time' | 'geo' | 'people' | 'concept';
