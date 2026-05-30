import { fmtDate, relative } from '../lib/dates.js';
import { venueMapUrl } from '../lib/venues.js';

const FORMAT_LABEL = {
  'show-tell': 'Show & Tell',
  'lean-coffee': 'Lean Coffee',
  'build': 'Build Together',
  'skill-share': 'Skill Share',
  'tool-explore': 'Tool Exploration',
  'tbd': 'TBD',
};

export default function ScheduleAhead({ schedule }) {
  const items = schedule.upcoming.slice(0, 6);
  return (
    <div className="card card-pad">
      <div className="h-section">Schedule ahead</div>

      <div className="mt-2 divide-y divide-border">
        {items.map((s, i) => (
          <div key={s.date} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className={`text-sm ${i === 0 ? 'font-semibold' : 'font-medium'}`}>
                {fmtDate(s.date)}
                <span className="ml-2 text-[11px] font-normal text-muted num">{relative(s.date)}</span>
              </div>
              {s.theme && <div className="text-xs text-muted truncate">{s.theme}</div>}
              {s.venue && (
                <div className="text-[11px] text-muted truncate">
                  @ {venueMapUrl(s.venue)
                    ? <a href={venueMapUrl(s.venue)} target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-border hover:decoration-foreground">{s.venue}</a>
                    : s.venue}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {s.format && s.format !== 'tbd' && (
                <span className="text-xs text-muted hidden sm:inline">{FORMAT_LABEL[s.format]}</span>
              )}
              <span className={`pill ${s.presenter ? 'pill-ok' : 'pill-mute'}`}>{s.presenter || 'open'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
