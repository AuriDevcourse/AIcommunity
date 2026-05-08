import { useEffect, useState } from 'react';
import data from './data.json';
import NextSession from './components/NextSession.jsx';
import ScheduleAhead from './components/ScheduleAhead.jsx';
import MembersGallery from './components/MembersGallery.jsx';
import SessionsGallery from './components/SessionsGallery.jsx';
import News from './components/News.jsx';
import FeedbackButton from './components/FeedbackButton.jsx';
import { Agentation } from 'agentation';
import { Calendar, Users } from 'lucide-react';
import { TODAY } from './lib/dates.js';

const TABS = [
  { key: 'cockpit',  label: 'Cockpit' },
  { key: 'news',     label: 'News' },
  { key: 'members',  label: 'Members' },
  { key: 'sessions', label: 'Sessions' },
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
    if (current !== tab) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);
  const todayIso = TODAY.toISOString().slice(0, 10);
  const upcomingFromToday = data.schedule.upcoming.filter((s) => s.date >= todayIso);
  const next = upcomingFromToday[0];
  const futureSchedule = { ...data.schedule, upcoming: upcomingFromToday };
  const lastNumber = data.sessions.length ? data.sessions[data.sessions.length - 1].number : 0;
  const todayLabel = TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center">
            <span className="text-sm font-semibold tracking-tight text-foreground">AI Workshop</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors ${
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

      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10 flex-1">
        <section className="mb-8 sm:mb-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <Calendar size={12} strokeWidth={2} />
            <span>{todayLabel}</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight">
            Build with AI. Show what you learned.
          </h1>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            <Stat icon={Calendar} value={data.sessions.length} label="sessions" hint={`last #${lastNumber}`} />
            <Stat icon={Users} value={data.members.length} label="members" />
          </div>
        </section>

        {tab === 'cockpit' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
              <NextSession session={next} />
            </div>
            <div className="col-span-12">
              <ScheduleAhead schedule={futureSchedule} />
            </div>
          </div>
        )}

        {tab === 'news' && <News />}
        {tab === 'members' && <MembersGallery members={data.members} />}
        {tab === 'sessions' && <SessionsGallery sessions={data.sessions} />}
      </main>

      {import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && <FeedbackButton />}
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

function Stat({ icon: Icon, value, label, hint }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} strokeWidth={2} className="text-muted" />
      <span className="text-foreground font-semibold num">{value}</span>
      <span className="text-sm text-muted">{label}</span>
      {hint && <span className="text-xs text-muted opacity-70 num">· {hint}</span>}
    </div>
  );
}
