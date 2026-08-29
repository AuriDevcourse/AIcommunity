import { useState } from 'react';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import { fmtDate, relative } from '../lib/dates.js';
import { googleCalendarUrl } from '../lib/session.js';

const FORMAT_LABEL = {
  'show-tell': 'Show & Tell',
  'lean-coffee': 'Lean Coffee',
  build: 'Build Together',
  'skill-share': 'Skill Share',
  'tool-explore': 'Tool Exploration',
  tbd: 'Format TBD',
};

// Warn before the planned schedule runs dry. Below this many future sessions
// the card nags instead of silently shrinking to nothing.
const RUNWAY_MIN = 3;
// Area 4.2 — eight identical rows is a wall. Show the near horizon, fold the rest.
const INITIAL_VISIBLE = 4;

function monthLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? 'Scheduled'
    : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Area 4.1 — grouping by month gives the eye somewhere to rest and makes the
// cadence legible at a glance.
function groupByMonth(items) {
  const groups = [];
  for (const s of items) {
    const key = monthLabel(s.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(s);
    else groups.push({ key, items: [s] });
  }
  return groups;
}

export default function ScheduleAhead({ schedule, cadence }) {
  const [expanded, setExpanded] = useState(false);
  const upcoming = schedule?.upcoming ?? [];
  // Area 4.7 — "edit data/schedule.json" is a maintainer instruction, not
  // something a member visiting the dashboard needs to see.
  const showMaintainerHints = import.meta.env.DEV;

  if (upcoming.length === 0) {
    return (
      <div className="card card-pad">
        <Header showHint={showMaintainerHints} />
        <div className="mt-4 rounded-lg border border-warn/40 bg-warn/5 p-4">
          <div className="text-sm font-semibold text-foreground">Nothing scheduled.</div>
          <p className="mt-1 text-sm text-muted">
            Every planned date has passed. Add the next dates to{' '}
            <span className="font-mono text-foreground">data/schedule.json</span> and re-run{' '}
            <span className="font-mono text-foreground">npm run build:data</span>.
          </p>
        </div>
      </div>
    );
  }

  const visible = expanded ? upcoming : upcoming.slice(0, INITIAL_VISIBLE);
  const groups = groupByMonth(visible);
  const hidden = upcoming.length - visible.length;

  return (
    <div className="card card-pad">
      <Header count={upcoming.length} showHint={showMaintainerHints} />

      {upcoming.length < RUNWAY_MIN && (
        <div className="mt-3 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-foreground">
          Only {upcoming.length} session{upcoming.length === 1 ? '' : 's'} left on the calendar — time to
          plan further ahead.
        </div>
      )}

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted mb-2">
              {group.key}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {group.items.map((s) => (
                <ScheduleRow
                  key={s.date}
                  session={s}
                  cadence={cadence}
                  isNext={s.date === upcoming[0].date}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {upcoming.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline underline-offset-2"
        >
          <ChevronDown
            size={13}
            strokeWidth={2.2}
            className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
            aria-hidden="true"
          />
          {expanded ? 'Show fewer' : `Show ${hidden} more date${hidden === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}

function Header({ count, showHint }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="h-section">Schedule ahead</div>
      {showHint ? (
        <div className="text-xs text-muted">
          edit <span className="font-mono text-foreground">data/schedule.json</span>
        </div>
      ) : (
        count != null && <div className="text-xs text-muted num">{count} planned</div>
      )}
    </div>
  );
}

function ScheduleRow({ session, cadence, isNext }) {
  // Area 4.5 — an unbooked venue three weeks out is the thing to act on, so it
  // gets colour; a confirmed one recedes.
  const venueTone =
    session.venueStatus === 'confirmed' ? 'pill-ok' : session.venueStatus === 'open' ? 'pill-warn' : 'pill-mute';

  return (
    <li
      className={`group relative p-3 rounded-lg border transition-colors ${
        isNext ? 'border-foreground bg-accent' : 'border-border bg-pill hover:bg-accent'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground">{fmtDate(session.date)}</span>
          {isNext && <span className="pill pill-acc flex-shrink-0">Next</span>}
        </div>
        <span className="text-[11px] text-muted num flex-shrink-0">{relative(session.date)}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted truncate">{FORMAT_LABEL[session.format] || 'Format TBD'}</span>
        {/* Area 4.4 */}
        <span className={`pill flex-shrink-0 ${session.presenter ? 'pill-ok' : 'pill-mute'}`}>
          {session.presenter || 'no presenter'}
        </span>
      </div>

      {session.theme && <div className="mt-1 text-xs text-muted truncate">{session.theme}</div>}

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {session.venue ? (
          <span className={`pill ${venueTone}`}>@ {session.venue}</span>
        ) : (
          <span className="pill pill-warn">venue open</span>
        )}
        {/* Area 4.6 — every row is a date someone might want to save. */}
        <a
          href={googleCalendarUrl(session, cadence)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
          aria-label={`Add ${fmtDate(session.date)} to calendar`}
        >
          <CalendarPlus size={12} strokeWidth={2.2} aria-hidden="true" />
          Add
        </a>
      </div>
    </li>
  );
}
