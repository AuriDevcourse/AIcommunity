import { useEffect, useState } from 'react';

// Live upcoming schedule from Google Calendar (/api/schedule). Falls back to the
// static build-time snapshot when the calendar isn't configured, returns nothing,
// or the fetch fails, so the dashboard never goes blank over a transient error.
// `source` is 'gcal' once live data is in, else 'static'.
export function useSchedule(fallbackUpcoming = []) {
  const [upcoming, setUpcoming] = useState(fallbackUpcoming);
  const [source, setSource] = useState('static');
  // 'loading' | 'live' | 'unconfigured' | 'stale'
  // 'unconfigured' means no calendar is wired up at all, which is a normal local
  // state; 'stale' means one IS wired up and we could not read it, which is the
  // only case worth warning a reader about.
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
