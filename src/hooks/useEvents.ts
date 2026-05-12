import { useEffect, useState } from 'react';
import type { EventsDocument } from '../types';

export type EventsLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; doc: EventsDocument };

export function useEvents(url: string = './events.json'): EventsLoadState {
  const [state, setState] = useState<EventsLoadState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((doc: EventsDocument) => {
        if (!alive) return;
        setState({ status: 'ready', doc });
      })
      .catch((err) => {
        if (!alive) return;
        setState({ status: 'error', error: String(err?.message ?? err) });
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
