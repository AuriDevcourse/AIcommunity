import { useEffect, useState } from 'react';

// Live upcoming schedule from Google Calendar (/api/schedule). Falls back to the
// static build-time snapshot when the calendar isn't configured, returns nothing,
// or the fetch fails — so the dashboard never goes blank over a transient error.
// `source` is 'gcal' once live data is in, else 'static'.
export function useSchedule(fallbackUpcoming = []) {
  const [upcoming, setUpcoming] = useState(fallbackUpcoming);
  const [source, setSource] = useState('static');

  useEffect(() => {
    let alive = true;
    fetch('/api/schedule')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.configured !== false && Array.isArray(d?.upcoming) && d.upcoming.length) {
          setUpcoming(d.upcoming);
          setSource('gcal');
        }
      })
      .catch(() => { /* keep the static fallback */ });
    return () => { alive = false; };
  }, []);

  return { upcoming, source };
}
