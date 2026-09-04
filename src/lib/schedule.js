import { useEffect, useState } from 'react';
import { rhythmSessions, nothingUpcoming } from './rhythm.js';
import { TODAY } from './dates.js';

// Three sources, in order of trust:
//   1. Google Calendar (/api/schedule), live, the source of truth when it answers.
//   2. data/schedule.json `upcoming`, the reviewed build-time snapshot.
//   3. The rhythm rule (data/schedule.json `rhythm`): every second Sunday from an
//      anchor date. Computed, never empty, so the site can always state its next
//      date even when the calendar is unreachable and the snapshot has gone stale.
//
// Pure, so it can be tested without React: what should be on screen given the
// static snapshot and the rhythm, before or instead of the live answer.
export function resolveUpcoming(staticUpcoming, rhythm, today = TODAY) {
  const list = Array.isArray(staticUpcoming) ? staticUpcoming : [];
  if (!nothingUpcoming(list, today)) return { upcoming: list, source: 'static' };
  const computed = rhythmSessions(rhythm, today, 3);
  if (computed.length) return { upcoming: computed, source: 'rhythm' };
  return { upcoming: list, source: 'static' };
}

// `source` is 'gcal' once live data is in, else 'static' or 'rhythm'.
// `status`: 'loading' | 'live' | 'unconfigured' | 'stale'.
// 'unconfigured' means no calendar is wired up at all, which is a normal local
// state; 'stale' means one IS wired up and we could not read it, which is the
// only case worth warning a reader about. In both cases the list on screen is
// the snapshot or the rhythm, never nothing.
export function useSchedule(fallbackUpcoming = [], rhythm = null) {
  const [initial] = useState(() => resolveUpcoming(fallbackUpcoming, rhythm));
  const [upcoming, setUpcoming] = useState(initial.upcoming);
  const [source, setSource] = useState(initial.source);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/schedule')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.configured === false) { setStatus('unconfigured'); return; }
        if (Array.isArray(d?.upcoming) && d.upcoming.length) {
          setUpcoming(d.upcoming);
          setSource('gcal');
          setStatus('live');
          return;
        }
        setStatus('stale');
      })
      .catch(() => { if (alive) setStatus('stale'); });
    return () => { alive = false; };
  }, []);

  return { upcoming, source, status };
}
