import { useEffect, useState } from 'react';

export interface PersonProfile {
  name: string;
  wikiTitle: string;
  portrait: string;
  life: string;
  tagline: string;
  bio: string;
}

interface PeopleDoc {
  people: PersonProfile[];
}

export function usePeople(url: string = './people.json'): Map<string, PersonProfile> {
  const [profiles, setProfiles] = useState<Map<string, PersonProfile>>(new Map());

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((doc: PeopleDoc) => {
        if (!alive) return;
        const map = new Map<string, PersonProfile>();
        for (const p of doc.people ?? []) map.set(p.name, p);
        setProfiles(map);
      })
      .catch(() => {
        // Profiles are optional enrichment; absence is non-fatal.
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return profiles;
}
