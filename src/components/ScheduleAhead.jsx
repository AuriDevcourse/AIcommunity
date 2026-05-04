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
        <div className="text-xs text-muted">edit <span className="font-mono text-foreground">data/schedule.json</span></div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {schedule.upcoming.map((s, i) => (
          <div key={s.date} className={`p-3 rounded-lg border transition-colors ${i === 0 ? 'border-foreground bg-accent' : 'border-border bg-pill hover:bg-accent'}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">{fmtDate(s.date)}</div>
              <span className="text-[11px] text-muted num">{relative(s.date)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted">{FORMAT_LABEL[s.format] || 'TBD'}</span>
              <span className={`pill ${s.presenter ? 'pill-ok' : 'pill-mute'}`}>
                {s.presenter || 'no presenter'}
              </span>
            </div>
            {s.theme && <div className="mt-1 text-xs text-muted truncate">{s.theme}</div>}
            {s.venue && <div className="mt-0.5 text-[11px] text-muted truncate opacity-80">@ {s.venue}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
