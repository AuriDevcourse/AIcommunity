import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import data from './data.json';
// Home-tab (default view) components stay eager so the landing paint isn't gated
// on a second chunk. The other tabs are code-split below, their JS only downloads
// when the user opens that tab, shrinking the initial bundle.
import NextSession from './components/NextSession.jsx';
import Hero from './components/Hero.jsx';
import RecentSessions from './components/RecentSessions.jsx';
// Suggestions and LatestDiscussion are no longer rendered anywhere. The files are
// kept for now in case the panels come back once the forum has real traffic; if
// they do not, delete both components.
import TopicsForTheDay from './components/TopicsForTheDay.jsx';
import AuthControls from './components/AuthControls.jsx';

const MembersGallery = lazy(() => import('./components/MembersGallery.jsx'));
const SessionsGallery = lazy(() => import('./components/SessionsGallery.jsx'));
const News = lazy(() => import('./components/News.jsx'));
const Tools = lazy(() => import('./components/Tools.jsx'));
const Discussions = lazy(() => import('./components/Discussions.jsx'));
const Learn = lazy(() => import('./components/Learn.jsx'));
const Projects = lazy(() => import('./components/Projects.jsx'));
const SessionRecap = lazy(() => import('./components/SessionRecap.jsx'));
const TopicsPresentation = lazy(() => import('./components/TopicsPresentation.jsx'));
const BrandAssets = lazy(() => import('./components/BrandAssets.jsx'));
import ThemeToggle from './components/ThemeToggle.jsx';
import LegalPage, { Footer, LEGAL_KEYS, FOOTER_KEYS } from './components/LegalPages.jsx';
import { Agentation } from 'agentation';
import { Users, LayoutDashboard, Newspaper, Wrench, Images, MessagesSquare, GraduationCap, Rocket, Menu, X, Check, Lock, LogIn } from 'lucide-react';
import { TODAY } from './lib/dates.js';
import { useSchedule } from './lib/schedule.js';
import { useAuth } from './lib/auth.jsx';

// `gated` tabs open only for signed-in members. Members and Photos show real
// names and faces; the Forum is where the group plans its Sundays. All three are
// for people in the room, so they sit behind sign-in. Home, Learn, News and
// Tools stay public: a stranger can learn what this is and when it happens.
// When Supabase is not configured there is no sign-in, so nothing is gated.
const TABS = [
  { key: 'home',        label: 'Home',     icon: LayoutDashboard },
  { key: 'discussions', label: 'Forum',    icon: MessagesSquare, gated: true },
  { key: 'learn',       label: 'Learn',    icon: GraduationCap },
  { key: 'projects',    label: 'Projects', icon: Rocket },
  { key: 'news',        label: 'News',     icon: Newspaper },
  { key: 'members',     label: 'Members', icon: Users, gated: true },
  { key: 'sessions',    label: 'Photos',   icon: Images, gated: true },
  { key: 'tools',       label: 'Tools',    icon: Wrench },
];
const TAB_KEYS = TABS.map((t) => t.key);

function readTabFromHash() {
  const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  if (h === 'polls') return 'discussions'; // polls moved into the Forum
  // A shared poll link. Polls live inside the Forum, so route there and let
  // Polls.jsx scroll to the one named in the hash.
  if (h.startsWith('poll/')) return 'discussions';
  if (h === 'cockpit') return 'home';      // renamed
  return (TAB_KEYS.includes(h) || FOOTER_KEYS.includes(h)) ? h : 'home';
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

/**
 * Offline notice.
 *
 * Every tab fetches something, and each fetch had its own failure copy, so
 * dropping the network produced a scatter of unrelated messages and never named
 * the actual cause. One banner says it once.
 *
 * navigator.onLine only knows whether there is a link, not whether the internet
 * is reachable, so this is a hint rather than a guarantee. It is still right for
 * the common case (laptop lid, tunnel, wifi drop) and it costs nothing.
 */
function OfflineNotice() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-14 z-30 border-b border-border bg-[var(--gold-wash-a)] px-4 py-2 text-center text-xs font-medium text-foreground"
    >
      You are offline. What is on screen still works; anything that needs the network will wait.
    </div>
  );
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
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  // Every tab write used to be a replaceState, so switching tabs left no history
  // entry and Back walked straight out of the site. Only the FIRST sync replaces,
  // because writing #home on load should not add an entry the user never asked
  // for; every later change pushes, so Back returns to the previous tab.
  //
  // A change that came FROM the browser (Back, Forward, a pasted link) has already
  // updated the hash by the time this runs, so `current === tab` and nothing is
  // written. That guard is what stops a pushState loop.
  const didInitialHashSync = useRef(false);
  useEffect(() => {
    if (recapDate || present) return; // the recap / present routes own the hash; don't overwrite it
    const current = window.location.hash.slice(1);
    // Don't rewrite the hash while it carries an auth callback (e.g. an
    // implicit-flow #access_token=...), or we'd wipe it before Supabase reads it.
    if (/access_token=|provider_token=|[?&]?error=/.test(current)) return;
    if (current === tab) {
      didInitialHashSync.current = true;
      return;
    }
    if (didInitialHashSync.current) {
      window.history.pushState(null, '', `#${tab}`);
    } else {
      window.history.replaceState(null, '', `#${tab}`);
      didInitialHashSync.current = true;
    }
  }, [tab, recapDate, present]);

  // Plan 1.3. The header is sticky, so on a scrolled page it floats over content
  // with nothing but a hairline border to separate the two. Lift it once the page
  // has actually moved, and leave it flat at the top where there is nothing to
  // lift off. rAF-throttled and passive: a scroll handler that writes state on
  // every event is the classic way to make a page feel heavy.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 4);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read(); // a reload can restore a scrolled position before any event fires
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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
  const isAssets = tab === 'assets';

  // The tab is the page as far as history, bookmarks and screen readers care;
  // every view previously reported the same title.
  useEffect(() => {
    const label = TABS.find((t) => t.key === tab)?.label;
    const view = recapDate ? 'Session recap'
      : isAssets ? 'Download assets'
      : isLegal ? 'Legal'
      : label || 'Home';
    document.title = `AI Sundays · ${view}`;
  }, [tab, recapDate, isLegal, isAssets]);


  // Upcoming sessions come live from Google Calendar when configured, else from
  // the static build-time snapshot (see useSchedule).
  // Calendar first, then the reviewed snapshot, then the rhythm rule (every
  // second Sunday), so `next` is never undefined and Home never says "Nothing
  // scheduled" because an API blinked.
  const { upcoming: liveUpcoming, status: scheduleStatus } = useSchedule(data.schedule.upcoming, data.schedule.rhythm);

  // Members-only tabs. `locked` is what the nav shows (a small lock next to the
  // label); the wall itself renders in place of the tab content below.
  const { enabled: authEnabled, user: authUser, loading: authLoading, openAuth } = useAuth();
  const isGated = (key) => authEnabled && Boolean(TABS.find((t) => t.key === key)?.gated);
  const locked = (key) => isGated(key) && !authUser && !authLoading;
  const todayIso = TODAY.toISOString().slice(0, 10);
  // Google Calendar only carries date/theme/venue/startsAt. Everything else a
  // session knows (topics, who is presenting, whether the venue is actually
  // booked, the maintainer notes) lives only in data/schedule.json, so graft the
  // static entry onto the live one by date. Live values win where both have
  // something, because the calendar is the more current source for the fields it
  // does carry.
  const staticByDate = Object.fromEntries(
    (data.schedule.upcoming || []).map((s) => [s.date, s]),
  );
  const GRAFTED = ['topics', 'presenter', 'venueStatus', 'roles', 'notes', 'number', 'luma'];
  const upcomingFromToday = liveUpcoming
    .filter((s) => s.date >= todayIso)
    .map((s) => {
      const base = staticByDate[s.date];
      if (!base) return s;
      const merged = { ...s };
      for (const key of GRAFTED) {
        const live = s[key];
        const has = Array.isArray(live) ? live.length > 0 : Boolean(live);
        if (!has && base[key] !== undefined) merged[key] = base[key];
      }
      return merged;
    });
  const next = upcomingFromToday[0];

  // One cover per session, newest first, for the landing-page strip. Committed
  // photos only: Blob uploads arrive async and would pop in after paint, and the
  // strip is the first thing on the page. Four is what fits at sm and up.
  const recentPhotos = useMemo(() => (
    [...data.sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => (s.photos || [])[0])
      .filter(Boolean)
      .slice(0, 4)
  ), [data.sessions]);

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

      <header className={`app-header sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur ${scrolled ? 'is-scrolled' : ''}`}>
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
              aria-label="AI Sundays, go to Home"
              className="tap-target flex items-center flex-shrink-0 rounded-md text-foreground"
            >
              <img src="/brand/logo.svg" alt="" width="92" height="32" className="brand-lockup brand-lockup--light" />
              <img src="/brand/logo-dark.svg" alt="" width="92" height="32" className="brand-lockup brand-lockup--dark" />
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
                    <span className="inline-flex items-center gap-1">
                      {t.label}
                      {locked(t.key) && <Lock size={11} strokeWidth={2.2} aria-label="members only" className="opacity-70" />}
                    </span>
                    {active && <span className="absolute inset-x-2.5 -bottom-1 h-0.5 rounded-full bg-foreground" aria-hidden />}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <ThemeToggle compact />
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
      <OfflineNotice />

      <div aria-live="polite" className="sr-only">
        {recapDate ? 'Session recap' : isAssets ? 'Download assets' : TABS.find((t) => t.key === tab)?.label || 'Home'} section
      </div>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 flex-1">
        {isAssets ? (
          <TabErrorBoundary key="eb-assets">
            <Suspense fallback={<TabFallback />}>
              <div key="assets" className="tab-enter">
                <BrandAssets onBack={() => goTo('home')} />
              </div>
            </Suspense>
          </TabErrorBoundary>
        ) : isLegal ? (
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
        {/* Home only. The masthead used to render on every tab, so Tools, Learn,
            News, Members, Photos and Forum each opened with the h1, the
            description and the art band before their OWN header, two stacked
            headings and about 410px of chrome above the first card, on a
            ~1070px page. Every tab has its own header, and the wordmark in the
            nav already carries the brand, so nothing is lost by dropping it. */}
        {tab === 'home' && (
          <Hero
            showGlance
            next={next}
            sessionCount={data.sessions.length}
            memberCount={data.memberCount || 0}
            scheduleStatus={scheduleStatus}
            recentPhotos={recentPhotos}
            onOpenPhotos={() => goTo('sessions')}
          />
        )}

        <TabErrorBoundary key={`eb-${tab}`}>
        <Suspense fallback={<TabFallback />}>
          <div key={tab} className="tab-enter">
            {isGated(tab) && !authUser ? (
              authLoading ? <TabFallback /> : <MembersOnly tab={tab} onSignIn={openAuth} />
            ) : (
            <>
            {tab === 'home' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12">
                  <NextSession session={next} onNavigate={goTo} />
                </div>
                <div className="col-span-12">
                  <RecentSessions sessions={data.sessions} onOpenRecap={openRecap} />
                </div>
                {/* Latest discussion and Top ideas were REMOVED from Home on
                    2026-09-01. Measured before removal: 312px each, 624px of a
                    2081px page, 30%, to show "No discussions yet" and two ideas
                    both posted by Auri. On a landing page an empty forum panel
                    argues the community is dead, which is the opposite of what
                    the rest of the page is for. Both live one nav click away in
                    Forum, which is where a member goes looking for them. */}
              </div>
            )}

            {tab === 'learn' && <Learn />}
            {tab === 'projects' && <Projects />}
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
            {tab === 'members' && <MembersGallery />}
            {tab === 'sessions' && <SessionsGallery sessions={data.sessions} gaps={data.schedule?.gaps || []} onOpenRecap={openRecap} />}
            </>
            )}
          </div>
        </Suspense>
        </TabErrorBoundary>
        </>
        )}
      </main>
      {/* polls render removed, now a pinned card in the Forum */}

      <Footer onNavigate={goTo} />

      {/* Mobile menu (hamburger). Desktop uses the top menu. */}
      {menuOpen && (
        <div data-print="hide" className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[color:var(--overlay)] backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden />
          <nav className="absolute top-0 inset-x-0 bg-background border-b border-border shadow-[var(--modal-shadow)]">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <button
                onClick={() => { goTo('home'); setMenuOpen(false); }}
                aria-label="AI Sundays, go to Home"
                className="flex items-center rounded-md text-foreground"
              >
                <img src="/brand/logo.svg" alt="" width="92" height="32" className="brand-lockup brand-lockup--light" />
                <img src="/brand/logo-dark.svg" alt="" width="92" height="32" className="brand-lockup brand-lockup--dark" />
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
                    {locked(t.key) && !active && <Lock size={14} strokeWidth={2} aria-label="members only" className="opacity-60" />}
                    {active && <Check size={16} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
            <div className="p-2 pt-0 border-t border-border pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}

      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

// What a signed-out visitor sees on a members-only tab. Says what is behind the
// door, then offers the one action. Home, Learn and News stay open, and the copy
// says so, because the point is to invite, not to shut out.
//
// This is a real boundary, not only a wall: the read routes behind these tabs
// (/api/members, /api/photos, /api/polls, /api/topics, /api/threads) require a
// signed-in member, RSVP and calendar reads return counts without names, and
// the bundle carries member and attendee COUNTS, never names. What stays public
// on purpose: the committed highlight photos on Home and in session recaps, and
// demo presenter first names in recaps (they are the point of a recap).
const WALL_COPY = {
  members: {
    title: 'Sign in to see who is in the room',
    body: 'The member directory shows real names and faces, so it stays inside the community.',
  },
  sessions: {
    title: 'Sign in to browse the photo archive',
    body: 'Every session, every photo. A few highlights stay on Home and in the session recaps.',
  },
  discussions: {
    title: 'Sign in to join the forum',
    body: 'Topics, ideas and polls are where members plan the next Sunday together.',
  },
};

function MembersOnly({ tab, onSignIn }) {
  const copy = WALL_COPY[tab] || { title: 'Sign in to open this page', body: 'This page is for members of the community.' };
  return (
    <section className="card card-pad mx-auto max-w-md text-center py-10" aria-labelledby="members-only-title">
      <span className="mx-auto grid place-items-center w-11 h-11 rounded-full bg-pill text-foreground" aria-hidden>
        <Lock size={18} strokeWidth={2} />
      </span>
      <h2 id="members-only-title" className="mt-4 text-lg font-semibold tracking-tight">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted leading-relaxed">{copy.body}</p>
      <button onClick={onSignIn} className="btn btn-primary mt-5">
        <LogIn size={14} strokeWidth={2.2} /> Sign in or create an account
      </button>
      <p className="mt-4 text-xs text-muted">Free, and takes a minute. Home, Learn and News stay open to everyone.</p>
    </section>
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

