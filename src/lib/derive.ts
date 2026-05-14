import type { ConceptRecord, DomainId, PersonRecord, PlaceRecord, RawEdge, RawEvent } from '../types';

/** Derived tables computed from events at load time. Cheap; no need to memo further. */
export interface DerivedTables {
  people: Map<string, PersonRecord>;
  places: Map<string, PlaceRecord>;
  concepts: Map<string, ConceptRecord>;
}

export function deriveTables(events: RawEvent[]): DerivedTables {
  const people = new Map<string, PersonRecord>();
  const places = new Map<string, PlaceRecord>();
  const concepts = new Map<string, ConceptRecord>();

  for (const ev of events) {
    const year = parseYearShallow(ev.date);
    for (const name of ev.keyFigures ?? []) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      let p = people.get(trimmed);
      if (!p) {
        p = {
          name: trimmed,
          events: [],
          totalImportance: 0,
          domains: new Map(),
          primaryDomain: ev.domain,
          dateMin: year,
          dateMax: year,
        };
        people.set(trimmed, p);
      }
      p.events.push(ev.id);
      p.totalImportance += ev.importance;
      p.domains.set(ev.domain, (p.domains.get(ev.domain) ?? 0) + 1);
      p.dateMin = Math.min(p.dateMin, year);
      p.dateMax = Math.max(p.dateMax, year);
    }
    for (const loc of ev.locations ?? []) {
      const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
      let pl = places.get(key);
      if (!pl) {
        pl = { key, label: loc.label, lat: loc.lat, lon: loc.lon, events: [] };
        places.set(key, pl);
      }
      pl.events.push(ev.id);
    }
    for (const c of ev.concepts ?? []) {
      const tag = c.trim().toLowerCase();
      if (!tag) continue;
      let cr = concepts.get(tag);
      if (!cr) {
        cr = {
          id: tag,
          events: [],
          domains: new Map(),
          dateMin: year,
          dateMax: year,
          frontier: false,
        };
        concepts.set(tag, cr);
      }
      cr.events.push(ev.id);
      cr.domains.set(ev.domain, (cr.domains.get(ev.domain) ?? 0) + 1);
      cr.dateMin = Math.min(cr.dateMin, year);
      cr.dateMax = Math.max(cr.dateMax, year);
      if (ev.frontier) cr.frontier = true;
    }
  }

  // Resolve primary domain (most-frequent) for each person.
  for (const p of people.values()) {
    let best: DomainId = p.primaryDomain;
    let bestN = -1;
    for (const [d, n] of p.domains) {
      if (n > bestN) {
        bestN = n;
        best = d;
      }
    }
    p.primaryDomain = best;
  }

  return { people, places, concepts };
}

function parseYearShallow(date: number | string): number {
  if (typeof date === 'number') return date;
  const m = date.match(/^(-?\d+)/);
  return m ? Number(m[1]) : 0;
}

/* ----- People-graph: co-event edges ----- */

export interface PersonEdge {
  source: string;
  target: string;
  /** Number of shared events. */
  weight: number;
}

/** Directed person-to-person influence, lifted from event edges. */
export interface PersonInfluence {
  /** Other person's name. */
  name: string;
  /** Event ids on this person's side of the link. */
  myEvents: Set<string>;
  /** Event ids on the other person's side. */
  theirEvents: Set<string>;
  /** Number of underlying event edges. */
  weight: number;
}

/**
 * For a given person, return:
 *   - `builtOn`: people whose events feed into this person's events (incoming).
 *   - `enabled`: people whose events this person's work fed into (outgoing).
 *   - `collaborators`: people who co-authored events with this person.
 * Self-links are filtered.
 */
export function getPersonInfluence(
  personName: string,
  events: RawEvent[],
  edges: RawEdge[],
): {
  builtOn: PersonInfluence[];
  enabled: PersonInfluence[];
  collaborators: PersonInfluence[];
} {
  const eventById = new Map(events.map((e) => [e.id, e]));
  const myEventIds = new Set(
    events.filter((e) => (e.keyFigures ?? []).includes(personName)).map((e) => e.id),
  );

  const incoming = new Map<string, PersonInfluence>();
  const outgoing = new Map<string, PersonInfluence>();

  const addInfluence = (
    map: Map<string, PersonInfluence>,
    name: string,
    myEv: string,
    theirEv: string,
  ) => {
    if (name === personName) return;
    let rec = map.get(name);
    if (!rec) {
      rec = { name, myEvents: new Set(), theirEvents: new Set(), weight: 0 };
      map.set(name, rec);
    }
    rec.myEvents.add(myEv);
    rec.theirEvents.add(theirEv);
    rec.weight += 1;
  };

  for (const edge of edges) {
    const sources = edge.source ? [edge.source] : edge.sources ?? [];
    const target = edge.target;
    const targetEv = eventById.get(target);
    if (!targetEv) continue;
    const targetFigs = targetEv.keyFigures ?? [];
    for (const src of sources) {
      const srcEv = eventById.get(src);
      if (!srcEv) continue;
      const srcFigs = srcEv.keyFigures ?? [];
      if (myEventIds.has(target)) {
        for (const srcFig of srcFigs) addInfluence(incoming, srcFig, target, src);
      }
      if (myEventIds.has(src)) {
        for (const tgtFig of targetFigs) addInfluence(outgoing, tgtFig, src, target);
      }
    }
  }

  const collaborators = new Map<string, PersonInfluence>();
  for (const id of myEventIds) {
    const ev = eventById.get(id);
    if (!ev) continue;
    for (const f of ev.keyFigures ?? []) {
      if (f === personName) continue;
      let rec = collaborators.get(f);
      if (!rec) {
        rec = { name: f, myEvents: new Set(), theirEvents: new Set(), weight: 0 };
        collaborators.set(f, rec);
      }
      rec.myEvents.add(id);
      rec.theirEvents.add(id);
      rec.weight += 1;
    }
  }

  const byWeight = (a: PersonInfluence, b: PersonInfluence) => b.weight - a.weight;
  return {
    builtOn: [...incoming.values()].sort(byWeight),
    enabled: [...outgoing.values()].sort(byWeight),
    collaborators: [...collaborators.values()].sort(byWeight),
  };
}

/** Co-event ties: for each event with ≥2 keyFigures, add an edge between each pair. */
export function buildPersonEdges(events: RawEvent[]): PersonEdge[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const figs = (ev.keyFigures ?? []).filter((s) => s && s.trim());
    if (figs.length < 2) continue;
    for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        const a = figs[i].trim();
        const b = figs[j].trim();
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const out: PersonEdge[] = [];
  for (const [key, weight] of counts) {
    const [a, b] = key.split('|');
    out.push({ source: a, target: b, weight });
  }
  return out;
}
