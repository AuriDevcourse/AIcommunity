import { fmtDate, relative } from '../lib/dates.js';

const FORMAT_LABEL = {
  'show-tell': 'Show & Tell',
  'lean-coffee': 'Lean Coffee',
  'build': 'Build Together',
  'skill-share': 'Skill Share',
  'tool-explore': 'Tool Exploration',
  'tbd': 'TBD',
};

export default function ScheduleAhead({ schedule }) {
  return (
    <div className="card card-pad">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Schedule ahead</div>
        <div className="text-xs text-ink-500">edit <span className="font-mono text-ink-300">data/schedule.json</span></div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {schedule.upcoming.map((s, i) => (
          <div key={s.date} className={`p-3 rounded-lg border ${i === 0 ? 'border-accent/40 bg-accent/5' : 'border-ink-700/60 bg-ink-800/30'}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{fmtDate(s.date)}</div>
              <span className="text-[11px] text-ink-400 num">{relative(s.date)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-ink-300">{FORMAT_LABEL[s.format] || 'TBD'}</span>
              <span className={`pill ${s.presenter ? 'pill-ok' : 'pill-mute'}`}>
                {s.presenter || 'no presenter'}
              </span>
            </div>
            {s.theme && <div className="mt-1 text-xs text-ink-400 truncate">{s.theme}</div>}
            {s.venue && <div className="mt-0.5 text-[11px] text-ink-500 truncate">@ {s.venue}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
