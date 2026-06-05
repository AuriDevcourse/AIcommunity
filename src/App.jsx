import { useEffect, useState } from 'react';
import data from './data.json';
import NextSession from './components/NextSession.jsx';
import ScheduleAhead from './components/ScheduleAhead.jsx';
import MembersGallery from './components/MembersGallery.jsx';
import SessionsGallery from './components/SessionsGallery.jsx';
import News from './components/News.jsx';
import Polls from './components/Polls.jsx';
import Tools from './components/Tools.jsx';
import Suggestions from './components/Suggestions.jsx';
import LatestDiscussion from './components/LatestDiscussion.jsx';
import Discussions from './components/Discussions.jsx';
import Learn from './components/Learn.jsx';
import AuthControls from './components/AuthControls.jsx';
import FeedbackButton from './components/FeedbackButton.jsx';
import { Agentation } from 'agentation';
import { Users, LayoutDashboard, Newspaper, BarChart3, Wrench, Images, MessagesSquare, GraduationCap, Menu, X, Check } from 'lucide-react';
import { TODAY } from './lib/dates.js';

const TABS = [
  { key: 'cockpit',     label: 'Cockpit',  icon: LayoutDashboard },
  { key: 'learn',       label: 'Learn',    icon: GraduationCap },
  { key: 'discussions', label: 'Forum',    icon: MessagesSquare },
  { key: 'news',        label: 'News',     icon: Newspaper },
  { key: 'polls',       label: 'Polls',    icon: BarChart3 },
  { key: 'tools',       label: 'Tools',    icon: Wrench },
  { key: 'members',     label: 'Members',  icon: Users },
  { key: 'sessions',    label: 'Sessions', icon: Images },
];
const TAB_KEYS = TABS.map((t) => t.key);

function readTabFromHash() {
  const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  return TAB_KEYS.includes(h) ? h : 'cockpit';
}

export default function App() {
  const [tab, setTab] = useState(readTabFromHash);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const current = window.location.hash.slice(1);
    // Don't rewrite the hash while it carries an auth callback (e.g. an
    // implicit-flow #access_token=...), or we'd wipe it before Supabase reads it.
    if (/access_token=|provider_token=|[?&]?error=/.test(current)) return;
    if (current !== tab) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);

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

  const todayIso = TODAY.toISOString().slice(0, 10);
  const upcomingFromToday = data.schedule.upcoming.filter((s) => s.date >= todayIso);
  const next = upcomingFromToday[0];
  const futureSchedule = { ...data.schedule, upcoming: upcomingFromToday };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-7 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <img src="/favicon.svg" alt="" width="24" height="24" className="rounded-md" />
              <span className="text-sm font-semibold tracking-tight text-foreground">AI Workshop</span>
            </div>
            {/* Desktop / tablet: top menu. Mobile uses the fixed bottom bar below. */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
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

      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 flex-1">
        <section className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
            Build with AI. Show what you learned.
          </h1>
          <div className="mt-6 rounded-2xl border border-border overflow-hidden">
            <img src="/brand/hero.png" alt="" loading="lazy" className="w-full h-28 sm:h-44 object-cover" />
          </div>
        </section>

        <div key={tab} className="tab-enter">
          {tab === 'cockpit' && (
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
          {tab === 'discussions' && <Discussions />}
          {tab === 'news' && <News />}
          {tab === 'polls' && <Polls />}
          {tab === 'tools' && <Tools sessions={data.sessions} />}
          {tab === 'members' && <MembersGallery members={data.members} />}
          {tab === 'sessions' && <SessionsGallery sessions={data.sessions} />}
        </div>
      </main>

      {/* Mobile menu (hamburger). Desktop uses the top menu. */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden />
          <nav className="absolute top-0 inset-x-0 bg-background border-b border-border shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <img src="/favicon.svg" alt="" width="24" height="24" className="rounded-md" />
                <span className="text-sm font-semibold tracking-tight">AI Workshop</span>
              </div>
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
                    onClick={() => { setTab(t.key); setMenuOpen(false); }}
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

