import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Hero from './src/components/Hero.jsx';
import './src/index.css';

// ---- timer instrumentation ----
const live = new Set();
let created = 0, cleared = 0;
const _st = window.setTimeout.bind(window), _ct = window.clearTimeout.bind(window);
window.setTimeout = (fn, ms, ...a) => {
  const id = _st((...b) => { live.delete(id); fn(...b); }, ms, ...a);
  live.add(id); created++;
  window.__timerLog.push({ ms, at: Date.now() });
  return id;
};
window.clearTimeout = (id) => { if (live.delete(id)) cleared++; return _ct(id); };
window.__timerLog = [];
window.__stats = () => ({ created, cleared, activeNow: live.size });

const P = new URLSearchParams(location.search);
const scenario = P.get('s') || 'none';
const offsetMin = Number(P.get('off') || 0);

function mk() {
  const now = Date.now();
  switch (scenario) {
    case 'far':      return { date: '2026-12-25', startsAt: new Date(now + 20 * 86400000).toISOString(), theme: 'Far' };
    case 'days':     return { date: '2026-09-02', startsAt: new Date(now + 3 * 86400000).toISOString(), theme: 'Days' };
    case 'boundary': return { date: '2026-08-30', startsAt: new Date(now + 3600000 + 4000).toISOString(), theme: 'Boundary' };
    case 'soon':     return { date: '2026-08-30', startsAt: new Date(now + 8000).toISOString(), theme: 'Soon' };
    case 'live':     return { date: '2026-08-30', startsAt: new Date(now - 3600000).toISOString(), theme: 'Live' };
    case 'past':     return { date: '2026-01-01', startsAt: new Date(now - 10 * 86400000).toISOString(), theme: 'Past' };
    case 'malformed':return { date: 'banana', startsAt: 'nope', theme: 'Bad' };
    case 'nodate':   return { theme: 'NoDate' };
    default:         return null;
  }
}
const NEXT = mk();
window.__next = NEXT;

function Harness() {
  const [n, setN] = useState(0);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const i = setInterval(() => setN((x) => x + 1), 50); // render storm
    window.__unmount = () => setMounted(false);
    return () => clearInterval(i);
  }, []);
  window.__renders = n;
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div id="renders">renders:{n}</div>
      {mounted && <Hero showGlance={P.get('glance') !== '0'} next={NEXT} sessionCount={8} memberCount={19} scheduleStatus={P.get('status') || 'stale'} />}
    </div>
  );
}
const el = document.getElementById('root');
createRoot(el).render(P.get('strict') === '0' ? <Harness /> : <StrictMode><Harness /></StrictMode>);
