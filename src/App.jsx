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
import ThemeToggle from './components/ThemeToggle.jsx';
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
    <div className="max-w-[1320px] mx-auto px-6 py-8">
      <header className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="h-section">AI Workshop · Cockpit</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">
            Build with AI. Show what you learned.
          </h1>
          <div className="text-ink-400 text-sm mt-1">
            {todayLabel} · Bi-weekly Sundays · Copenhagen
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ThemeToggle />
          <div className="text-right text-xs text-ink-400 num">
            <div>{data.sessions.length} sessions logged · last #{lastNumber}</div>
            <div>{data.members.length} members · {data.backlog.length} in backlog</div>
          </div>
        </div>
      </header>

      <nav className="mb-6 border-b border-ink-800 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.key
                ? 'border-accent text-ink-100'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'cockpit' && (
        <div className="grid grid-cols-12 gap-5">
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

      <footer className="mt-10 text-center text-xs text-ink-500 num">
        data generated {new Date(data.generatedAt).toLocaleString('en-GB')}
      </footer>

      <FeedbackButton />
    </div>
  );
}
