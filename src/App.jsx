import { Component, lazy, Suspense, useEffect, useState } from 'react';
import data from './data.json';
// Home-tab (default view) components stay eager so the landing paint isn't gated
// on a second chunk. The other tabs are code-split below — their JS only downloads
// when the user opens that tab, shrinking the initial bundle.
import NextSession from './components/NextSession.jsx';
import ScheduleAhead from './components/ScheduleAhead.jsx';
import Suggestions from './components/Suggestions.jsx';
import LatestDiscussion from './components/LatestDiscussion.jsx';
import TopicsForTheDay from './components/TopicsForTheDay.jsx';
import AuthControls from './components/AuthControls.jsx';

const MembersGallery = lazy(() => import('./components/MembersGallery.jsx'));
const SessionsGallery = lazy(() => import('./components/SessionsGallery.jsx'));
const News = lazy(() => import('./components/News.jsx'));
const Tools = lazy(() => import('./components/Tools.jsx'));
const Discussions = lazy(() => import('./components/Discussions.jsx'));
const Learn = lazy(() => import('./components/Learn.jsx'));
const SessionRecap = lazy(() => import('./components/SessionRecap.jsx'));
const TopicsPresentation = lazy(() => import('./components/TopicsPresentation.jsx'));
import FeedbackButton from './components/FeedbackButton.jsx';
import LegalPage, { Footer, LEGAL_KEYS } from './components/LegalPages.jsx';
import { Agentation } from 'agentation';
import { Users, LayoutDashboard, Newspaper, Wrench, Images, MessagesSquare, GraduationCap, Menu, X, Check } from 'lucide-react';
import { TODAY } from './lib/dates.js';
import { useSchedule } from './lib/schedule.js';

const TABS = [
  { key: 'home',        label: 'Home',     icon: LayoutDashboard },
  { key: 'discussions', label: 'Forum',    icon: MessagesSquare },
  { key: 'learn',       label: 'Learn',    icon: GraduationCap },
  { key: 'news',        label: 'News',     icon: Newspaper },
  { key: 'members',     label: 'Members',  icon: Users },
  { key: 'sessions',    label: 'Photos',   icon: Images },
  { key: 'tools',       label: 'Tools',    icon: Wrench },
];
const TAB_KEYS = TABS.map((t) => t.key);

function readTabFromHash() {
  const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  if (h === 'polls') return 'discussions'; // polls moved into the Forum
  if (h === 'cockpit') return 'home';      // renamed
  return (TAB_KEYS.includes(h) || LEGAL_KEYS.includes(h)) ? h : 'home';
}

// Recap pages live at #recap/<date>. Returns the date or null.
function readRecapDate() {
  const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const m = h.match(/^recap\/(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

// The topics slide deck lives at #present (opened in a new tab from the Forum).
function readPresent() {
  return (typeof window !== 'undefined' ? window.location.hash.slice(1) : '') === 'present';
}

export default function App() {
  const [tab, setTab] = useState(readTabFromHash);
  const [recapDate, setRecapDate] = useState(readRecapDate);
  const [present, setPresent] = useState(readPresent);
  const [menuOpen, setMenuOpen] = useState(false);

  // Recap is lazy-loaded, so re-pin to the top once its content actually mounts.
  // Instant (not smooth) so it never animates from a mid-page scroll position.
  useEffect(() => {
    if (recapDate && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [recapDate]);

  useEffect(() => {
    const onHashChange = () => {
      const rd = readRecapDate();
      const pr = readPresent();
      setRecapDate(rd);
      setPresent(pr);
      if (!rd && !pr) setTab(readTabFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (recapDate || present) return; // the recap / present routes own the hash; don't overwrite it
    const current = window.location.hash.slice(1);
    // Don't rewrite the hash while it carries an auth callback (e.g. an
    // implicit-flow #access_token=...), or we'd wipe it before Supabase reads it.
    if (/access_token=|provider_token=|[?&]?error=/.test(current)) return;
    if (current !== tab) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab, recapDate, present]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Jump to the Forum tab, optionally deep-linking to a specific topic (the
  // Discussions component reads this on mount and expands it).
  const openForum = (topicId) => {
    if (topicId) { try { sessionStorage.setItem('forum_open_topic', topicId); } catch { /* ignore */ } }
    setTab('discussions');
  };

  // Navigate to a tab or legal page and jump to the top (used by the footer + back).
  const goTo = (key) => {
    if (typeof window !== 'undefined' && readRecapDate()) window.location.hash = key; // leave a recap route cleanly
    setTab(key);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };
  // Open a session's public recap page (hash route owns navigation).
  const openRecap = (date) => {
    if (typeof window !== 'undefined') { window.location.hash = `recap/${date}`; window.scrollTo({ top: 0, behavior: 'instant' }); }
  };
  const isLegal = LEGAL_KEYS.includes(tab);

  // The tab is the page as far as history, bookmarks and screen readers care;
  // every view previously reported the same title.
  useEffect(() => {
    const label = TABS.find((t) => t.key === tab)?.label;
    const view = recapDate ? 'Session recap' : isLegal ? 'Legal' : label || 'Home';
    document.title = `AI Workshop · ${view}`;
  }, [tab, recapDate, isLegal]);


  // Upcoming sessions come live from Google Calendar when configured, else from
  // the static build-time snapshot (see useSchedule).
  const { upcoming: liveUpcoming } = useSchedule(data.schedule.upcoming);
  const todayIso = TODAY.toISOString().slice(0, 10);
  // Google Calendar only carries date/theme/venue, so graft the per-session
  // topics from the static schedule onto the live session by date.
  const topicsByDate = Object.fromEntries(
    (data.schedule.upcoming || []).filter((s) => s.topics?.length).map((s) => [s.date, s.topics])
  );
  const upcomingFromToday = liveUpcoming
    .filter((s) => s.date >= todayIso)
    .map((s) => (s.topics?.length ? s : { ...s, topics: topicsByDate[s.date] || [] }));
  const next = upcomingFromToday[0];
  const futureSchedule = { ...data.schedule, upcoming: upcomingFromToday };

  // #present renders the topics slide deck on its own (no header/nav), so it can
  // drive a projector in a separate tab.
  if (present) {
    return (
      <Suspense fallback={<TabFallback />}>
        <TopicsPresentation session={next} onClose={() => { window.location.hash = 'discussions'; }} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-7 min-w-0">
            {/* The wordmark is the universal "take me home" affordance and this
                one was an inert div. Anchor so middle-click and open-in-new-tab
                behave, with the click intercepted for client-side routing. */}
            <a
              href="#home"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                goTo('home');
              }}
              aria-label="AI Workshop — go to Home"
              className="flex items-center gap-2 flex-shrink-0 rounded-md text-foreground"
            >
              <img src="/favicon.svg" alt="" width="24" height="24" className="rounded-md" />
              <span className="text-sm font-semibold tracking-tight">AI Workshop</span>
            </a>
            {/* Desktop / tablet: top menu. Mobile uses the fixed bottom bar below. */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => goTo(t.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'text-foreground' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {t.label}
                    {active && <span className="absolute inset-x-2.5 -bottom-1 h-0.5 rounded-full bg-foreground" aria-hidden />}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && <FeedbackButton />}
            <AuthControls />
            {/* Mobile: hamburger opens the full nav. Desktop uses the top menu. */}
            <button
              onClick={() => setMenuOpen(true)}
              className="sm:hidden grid place-items-center w-9 h-9 rounded-full border border-border bg-pill text-foreground hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <div aria-live="polite" className="sr-only">
        {recapDate ? 'Session recap' : TABS.find((t) => t.key === tab)?.label || 'Home'} section
      </div>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 flex-1">
        {isLegal ? (
          <div key={tab} className="tab-enter">
            <LegalPage slug={tab} onBack={() => goTo('home')} />
          </div>
        ) : recapDate ? (
          <TabErrorBoundary key={`eb-recap-${recapDate}`}>
            <Suspense fallback={<TabFallback />}>
              <div key={`recap-${recapDate}`} className="tab-enter">
                <SessionRecap date={recapDate} sessions={data.sessions} onBack={() => goTo('sessions')} />
              </div>
            </Suspense>
          </TabErrorBoundary>
        ) : (
        <>
        <section className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
            Build with AI. Show what you learned.
          </h1>
          <div className="mt-6 rounded-2xl border border-border overflow-hidden">
            <img src="/brand/hero.webp" alt="" width="1600" height="176" fetchpriority="high" decoding="async" className="w-full h-28 sm:h-44 object-cover" />
          </div>
        </section>

        <TabErrorBoundary key={`eb-${tab}`}>
        <Suspense fallback={<TabFallback />}>
          <div key={tab} className="tab-enter">
            {tab === 'home' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12">
                  <NextSession session={next} />
                </div>
                <div className="col-span-12">
                  <ScheduleAhead schedule={futureSchedule} />
                </div>
                <div className="col-span-12 md:col-span-6">
                  <LatestDiscussion onOpenForum={openForum} />
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Suggestions onOpenForum={openForum} />
                </div>
              </div>
            )}

            {tab === 'learn' && <Learn />}
            {tab === 'discussions' && (
              <div className="grid grid-cols-12 gap-6 items-start">
                <div className="col-span-12 lg:col-span-5 xl:col-span-4">
                  <TopicsForTheDay session={next} />
                </div>
                <div className="col-span-12 lg:col-span-7 xl:col-span-8">
                  <Discussions />
                </div>
              </div>
            )}
            {tab === 'news' && <News />}
            {tab === 'tools' && <Tools sessions={data.sessions} />}
            {tab === 'members' && <MembersGallery members={data.members} />}
            {tab === 'sessions' && <SessionsGallery sessions={data.sessions} onOpenRecap={openRecap} />}
          </div>
        </Suspense>
        </TabErrorBoundary>
        </>
        )}
      </main>
      {/* polls render removed — now a pinned card in the Forum */}

      <Footer onNavigate={goTo} />

      {/* Mobile menu (hamburger). Desktop uses the top menu. */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden />
          <nav className="absolute top-0 inset-x-0 bg-background border-b border-border shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <button
                onClick={() => { goTo('home'); setMenuOpen(false); }}
                aria-label="AI Workshop — go to Home"
                className="flex items-center gap-2 rounded-md text-foreground"
              >
                <img src="/favicon.svg" alt="" width="24" height="24" className="rounded-md" />
                <span className="text-sm font-semibold tracking-tight">AI Workshop</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-accent transition-colors" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="p-2 grid gap-0.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { goTo(t.key); setMenuOpen(false); }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active ? 'bg-accent text-foreground' : 'text-muted hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span className="flex-1 text-left">{t.label}</span>
                    {active && <Check size={16} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

// Catches failures from the code-split tab imports. The common one is a stale
// chunk: after a new deploy (or a dev-server restart), a page loaded earlier
// references hashed chunk files that no longer exist, so the dynamic import 404s.
// We auto-reload ONCE to pick up the new asset map, then fall back to a manual
// retry (guarded so it can never loop).
class TabErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    const stale = /dynamically imported module|module script failed|failed to fetch|chunkloaderror/i.test(String(err?.message || err));
    if (stale && !sessionStorage.getItem('chunkReloaded')) {
      sessionStorage.setItem('chunkReloaded', '1');
      window.location.reload();
    }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card card-pad text-center text-sm text-muted">
        <p>Couldn’t load this section. The app may have just updated.</p>
        <button
          onClick={() => { sessionStorage.removeItem('chunkReloaded'); window.location.reload(); }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02]"
        >
          Reload
        </button>
      </div>
    );
  }
}

// Shown for the brief moment a code-split tab's chunk is downloading.
function TabFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-7 w-48" />
      <div className="skeleton h-4 w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-40 w-full rounded-2xl" />)}
      </div>
    </div>
  );
}

