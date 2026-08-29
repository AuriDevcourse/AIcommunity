import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import data from './data.json';
import NextSession from './components/NextSession.jsx';
import ScheduleAhead from './components/ScheduleAhead.jsx';
import FeedbackButton from './components/FeedbackButton.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import OpenActions from './components/OpenActions.jsx';
import DemoBacklog from './components/DemoBacklog.jsx';
import TopicPoll from './components/TopicPoll.jsx';
import Hero from './components/Hero.jsx';
import Footer from './components/Footer.jsx';
import { Agentation } from 'agentation';
import { TODAY, toIso } from './lib/dates.js';

// Area 10.5 — the three secondary tabs are image- and text-heavy and most
// visits only ever look at the cockpit, so they load on demand.
const News = lazy(() => import('./components/News.jsx'));
const MembersGallery = lazy(() => import('./components/MembersGallery.jsx'));
const SessionsGallery = lazy(() => import('./components/SessionsGallery.jsx'));

const TABS = [
  { key: 'cockpit', label: 'Cockpit', title: 'Cockpit' },
  { key: 'news', label: 'News', title: 'AI News' },
  { key: 'members', label: 'Members', title: 'Members' },
  { key: 'sessions', label: 'Sessions', title: 'Sessions' },
];
const TAB_KEYS = TABS.map((t) => t.key);

// data.json is a build artefact; on a server with no vault it is a committed
// snapshot that can silently be months old.
const STALE_DATA_DAYS = 45;

function dataAge(generatedAt) {
  if (!generatedAt) return null;
  const t = new Date(generatedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((TODAY.getTime() - t) / 86400000);
}

function readTabFromHash() {
  const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  return TAB_KEYS.includes(h) ? h : 'cockpit';
}

function TabFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading section">
      <div className="skeleton h-8 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-3">
            <div className="skeleton aspect-video w-full rounded-2xl" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(readTabFromHash);
  const [scrolled, setScrolled] = useState(false);
  const [dismissedStale, setDismissedStale] = useState(false);
  const tabRefs = useRef({});

  // Area 1.9 — pushState, so the browser back button steps through the tabs a
  // visitor actually visited instead of leaving the site.
  const goToTab = useCallback((next) => {
    setTab(next);
    if (window.location.hash.slice(1) !== next) {
      window.history.pushState(null, '', `#${next}`);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  // Area 1.5 — the tab is the page as far as history and bookmarks care.
  useEffect(() => {
    const meta = TABS.find((t) => t.key === tab);
    document.title = `AI Workshop · ${meta ? meta.title : 'Cockpit'}`;
    if (!window.location.hash) window.history.replaceState(null, '', '#cockpit');
  }, [tab]);

  // Area 1.3 — the border is noise at rest and useful once content slides under.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A tablist role promises arrow-key navigation. Roving tabindex + arrows
  // completes the pattern rather than advertising behaviour that isn't there.
  function onTabKeyDown(e) {
    const i = TAB_KEYS.indexOf(tab);
    let nextKey = null;
    if (e.key === 'ArrowRight') nextKey = TAB_KEYS[(i + 1) % TAB_KEYS.length];
    else if (e.key === 'ArrowLeft') nextKey = TAB_KEYS[(i - 1 + TAB_KEYS.length) % TAB_KEYS.length];
    else if (e.key === 'Home') nextKey = TAB_KEYS[0];
    else if (e.key === 'End') nextKey = TAB_KEYS[TAB_KEYS.length - 1];
    if (!nextKey) return;
    e.preventDefault();
    goToTab(nextKey);
    tabRefs.current[nextKey]?.focus();
  }

  const todayIso = toIso(TODAY);
  // These run OUTSIDE the tab-level boundary below, so a throw here would take
  // the whole shell with it. data.json is machine-generated from markdown, so
  // treat every field as untrusted rather than merely checking array-ness.
  const sessions = Array.isArray(data.sessions) ? data.sessions.filter(Boolean) : [];
  const members = Array.isArray(data.members) ? data.members.filter(Boolean) : [];
  const openActions = Array.isArray(data.openActions) ? data.openActions : [];
  const upcomingFromToday = (data.schedule?.upcoming ?? []).filter((s) => s?.date >= todayIso);
  const next = upcomingFromToday[0];
  const futureSchedule = { ...data.schedule, upcoming: upcomingFromToday };
  const lastNumber = sessions.length ? sessions[sessions.length - 1]?.number ?? 0 : 0;
  const dataAgeDays = dataAge(data.generatedAt);
  const cadence = data.schedule?.cadence;

  return (
    <div className="min-h-full flex flex-col">
      {/* Area 1.1 */}
      <a href="#tab-panel" className="skip-link no-print">Skip to content</a>

      <header
        className={`sticky top-0 z-30 bg-background/85 backdrop-blur transition-shadow no-print ${
          scrolled
            ? 'border-b border-border shadow-[0_1px_12px_rgba(0,0,0,0.06)]'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-6">
          {/* Area 1.7 */}
          <a
            href="#cockpit"
            onClick={(e) => { e.preventDefault(); goToTab('cockpit'); }}
            className="flex items-center gap-2 flex-shrink-0 rounded-md text-foreground"
          >
            <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" className="flex-shrink-0">
              <rect width="32" height="32" rx="7" fill="currentColor" />
              <g fill="none" stroke="var(--background)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 26 L16 7 L25 26" />
                <path d="M10.6 19.5 H21.4" />
              </g>
            </svg>
            <span className="text-sm font-semibold tracking-tight">AI Workshop</span>
          </a>

          <nav
            className="tabs-scroll flex items-center gap-1 sm:gap-1.5 -mx-1 px-1"
            role="tablist"
            aria-label="Dashboard sections"
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                ref={(el) => { tabRefs.current[t.key] = el; }}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="tab-panel"
                tabIndex={tab === t.key ? 0 : -1}
                onClick={() => goToTab(t.key)}
                className={`flex-shrink-0 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Area 1.6 — screen readers get told the panel changed. */}
      <div aria-live="polite" className="sr-only">
        {TABS.find((t) => t.key === tab)?.title} section
      </div>

      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 flex-1">
        <Hero
          sessions={sessions}
          members={members}
          lastNumber={lastNumber}
          next={next}
          cadence={cadence}
          staleDays={dataAgeDays !== null && dataAgeDays > STALE_DATA_DAYS && !dismissedStale ? dataAgeDays : null}
          onDismissStale={() => setDismissedStale(true)}
        />

        {/* Keyed by tab so switching away from a broken panel clears the error
            and the header/nav stay usable even when one view throws. */}
        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
          <ErrorBoundary key={tab}>
            <Suspense fallback={<TabFallback />}>
              {tab === 'cockpit' && (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12">
                    <NextSession session={next} cadence={cadence} backlog={data.backlog} />
                  </div>
                  <div className="col-span-12">
                    <TopicPoll />
                  </div>
                  <div className="col-span-12">
                    <ScheduleAhead schedule={futureSchedule} cadence={cadence} />
                  </div>
                  <div className="col-span-12 lg:col-span-5">
                    <DemoBacklog backlog={data.backlog} />
                  </div>
                  <div className="col-span-12 lg:col-span-7">
                    <OpenActions actions={openActions} />
                  </div>
                </div>
              )}

              {tab === 'news' && <News />}
              {tab === 'members' && <MembersGallery members={members} sessions={sessions} />}
              {tab === 'sessions' && <SessionsGallery sessions={sessions} schedule={data.schedule} />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <Footer generatedAt={data.generatedAt} sessionCount={sessions.length} memberCount={members.length} />

      {import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && <FeedbackButton />}
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}
