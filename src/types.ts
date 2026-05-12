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

export type EdgeType = 'enables' | 'influences' | 'refines';

export interface RawEvent {
  id: string;
  label: string;
  date: number | string;
  dateUncertainty?: number;
  domain: DomainId;
  subdomain?: string;
  description: string;
  keyFigures?: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  frontier?: boolean;
  sources?: string[];
}

export interface RawEdge {
  source: string;
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
