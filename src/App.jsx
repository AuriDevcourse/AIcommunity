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
import { Users, LayoutDashboard, Newspaper, BarChart3, Wrench, Images, MessagesSquare, GraduationCap } from 'lucide-react';
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
            {/* Mobile: show the active section name for context next to the brand. */}
            <span className="sm:hidden text-xs font-medium text-muted">
              {TABS.find((t) => t.key === tab)?.label}
            </span>
            {import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && <FeedbackButton />}
            <AuthControls />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-10 flex-1">
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
                <Suggestions />
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

      {/* Mobile bottom tab bar: app-like nav with large tap targets. */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {/* Fills the width when there's room; scrolls horizontally when tabs outgrow it. */}
        <div className="flex overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-1 min-w-[64px] flex-col items-center justify-center gap-1 min-h-[60px] px-1 py-2 transition-colors ${
                  active ? 'text-foreground' : 'text-muted'
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-6 rounded-full bg-foreground" aria-hidden />}
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

