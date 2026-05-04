import { useState } from 'react';
import data from './data.json';
import NextSession from './components/NextSession.jsx';
import DemoBacklog from './components/DemoBacklog.jsx';
import ScheduleAhead from './components/ScheduleAhead.jsx';
import ContentPipeline from './components/ContentPipeline.jsx';
import OrgHealth from './components/OrgHealth.jsx';
import Members from './components/Members.jsx';
import ActionItems from './components/ActionItems.jsx';
import PastSessions from './components/PastSessions.jsx';
import News from './components/News.jsx';
import FeedbackButton from './components/FeedbackButton.jsx';
import { TODAY } from './lib/dates.js';

const TABS = [
  { key: 'cockpit', label: 'Cockpit' },
  { key: 'news',    label: 'News' },
];

export default function App() {
  const [tab, setTab] = useState('cockpit');
  const next = data.schedule.upcoming[0];
  const lastNumber = data.sessions.length ? data.sessions[data.sessions.length - 1].number : 0;
  const todayLabel = TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">AI Workshop</span>
            <span className="text-muted">·</span>
            <span className="text-sm text-foreground">Cockpit</span>
          </div>
          <nav className="flex items-center gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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

      <main className="mx-auto w-full max-w-[1400px] px-6 py-10 flex-1">
        <section className="mb-10">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {todayLabel} · Bi-weekly Sundays · Copenhagen
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight">
            Build with AI. Show what you learned.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted max-w-[60ch]">
            Cockpit for the bi-weekly Copenhagen meetup — what's next, what's queued, what's still open.
          </p>
          <div className="mt-4 text-xs text-muted num">
            {data.sessions.length} sessions logged · last #{lastNumber} · {data.members.length} members · {data.backlog.length} in backlog
          </div>
        </section>

        {tab === 'cockpit' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              <NextSession session={next} backlog={data.backlog} />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <DemoBacklog backlog={data.backlog} members={data.members} />
            </div>

            <div className="col-span-12 lg:col-span-7">
              <ScheduleAhead schedule={data.schedule} />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <ContentPipeline sessions={data.sessions} />
            </div>

            <div className="col-span-12 lg:col-span-5">
              <OrgHealth sessions={data.sessions} members={data.members} />
            </div>
            <div className="col-span-12 lg:col-span-7">
              <ActionItems actions={data.openActions} />
            </div>

            <div className="col-span-12 lg:col-span-5">
              <Members members={data.members} sessions={data.sessions} />
            </div>
            <div className="col-span-12 lg:col-span-7">
              <PastSessions sessions={data.sessions} gaps={data.schedule.gaps} />
            </div>
          </div>
        )}

        {tab === 'news' && <News />}

        <footer className="mt-16 pt-6 border-t border-border text-center text-xs text-muted num">
          data generated {new Date(data.generatedAt).toLocaleString('en-GB')}
        </footer>
      </main>

      {import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && <FeedbackButton />}
    </div>
  );
}
