import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronDown, MapPin } from 'lucide-react';
import { fmtDate, relative, parseDate } from '../lib/dates.js';
import { googleCalendarUrl } from '../lib/calendar.js';
import { venueMapUrl } from '../lib/venues.js';

const FORMAT_LABEL = {
  'show-tell': 'Show & Tell',
  'lean-coffee': 'Lean Coffee',
  'build': 'Build Together',
  'skill-share': 'Skill Share',
  'tool-explore': 'Tool Exploration',
  'tbd': 'TBD',
};

// How many rows before the list folds. One month of a biweekly cadence is two
// or three, so four shows the near future without becoming the wall it was.
const INITIAL = 4;

// A venue is only worth colouring when it is NOT settled. "confirmed" is the
// normal state and gets no treatment, or every row lights up and the signal dies.
const VENUE_PILL = {
  tentative: { cls: 'pill-warn', label: 'location tentative' },
  requested: { cls: 'pill-warn', label: 'location requested' },
  unconfirmed: { cls: 'pill-warn', label: 'location unconfirmed' },
  cancelled: { cls: 'pill-err', label: 'location cancelled' },
};

// A date range wants no weekday: "22 Feb to 19 Apr" reads as a span, where
// "Sun 22 Feb to Sun 19 Apr" reads as two appointments.
const gapDate = (iso) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (iso) =>
  parseDate(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Group consecutive sessions by calendar month, preserving order. */
function byMonth(list) {
  const groups = [];
  for (const s of list) {
    const key = monthKey(s.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(s);
    else groups.push({ key, label: monthLabel(s.date), items: [s] });
  }
  return groups;
}

export default function ScheduleAhead({ schedule }) {
  const all = schedule.upcoming || [];
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? all : all.slice(0, INITIAL);
  const groups = useMemo(() => byMonth(shown), [shown]);
  const hidden = all.length - shown.length;

  // The venue is the same for nearly every session, so repeating the full
  // address on all six rows was pure noise. Show it once in the header and only
  // annotate a row when it differs.
  const venues = [...new Set(all.map((s) => s.venue).filter(Boolean))];
  const commonVenue = venues.length === 1 ? venues[0] : null;

  // Recorded breaks in the cadence, so a hole in the archive reads as a
  // deliberate pause rather than missing data.
  const gaps = schedule.gaps || [];

  // Maintainer-only detail: roles and planning notes help whoever runs the
  // session and mean nothing to a member. import.meta.env.DEV is true in `npm
  // run dev` and false in every build, so this never ships.
  const showHints = import.meta.env.DEV;

  if (all.length === 0) {
    return (
      <div className="card card-pad">
        <div className="h-section">Schedule ahead</div>
        <p className="mt-2 text-sm text-muted">
          No dates on the calendar yet. Add the next few so people can plan.
        </p>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="h-section">Schedule ahead</div>
        {commonVenue && (
          <div className="text-[11px] text-muted min-w-0">
            All at{' '}
            {venueMapUrl(commonVenue)
              ? (
                <a
                  href={venueMapUrl(commonVenue)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 decoration-border hover:decoration-foreground"
                >
                  {commonVenue}
                </a>
              )
              : commonVenue}
          </div>
        )}
      </div>

      {/* Runway. Two dates left is about a month at this cadence, which is when
          it is worth saying something rather than after the list empties. */}
      {all.length <= 2 && (
        <p className="mt-2 text-xs text-warn">
          Only {all.length === 1 ? 'one date' : `${all.length} dates`} scheduled. Add more in
          the calendar so the schedule stays useful.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1">
              {group.label}
            </div>
            <div className="divide-y divide-border">
              {group.items.map((s) => (
                <Row
                  key={s.date}
                  session={s}
                  isNext={s.date === all[0].date}
                  commonVenue={commonVenue}
                  showHints={showHints}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 tap-target inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline underline-offset-2"
        >
          <ChevronDown size={14} />
          {hidden} more {hidden === 1 ? 'date' : 'dates'}
        </button>
      )}
      {expanded && all.length > INITIAL && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 tap-target inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
        >
          Show fewer
        </button>
      )}

      {gaps.map((g) => (
        <p key={`${g.from}-${g.to}`} className="mt-3 text-[11px] text-muted">
          Gap on record: {gapDate(g.from)} to {gapDate(g.to)}.{g.reason ? ` ${g.reason}` : ''}
        </p>
      ))}
    </div>
  );
}

function Row({ session: s, isNext, commonVenue, showHints }) {
  const cal = googleCalendarUrl(s);
  const venuePill = VENUE_PILL[String(s.venueStatus || '').toLowerCase()];
  const ownVenue = s.venue && s.venue !== commonVenue ? s.venue : null;
  const hostRole = s.roles?.host;

  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 sm:py-2.5 ${
        isNext ? 'sm:-mx-2 sm:px-2 rounded-lg bg-accent/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm ${isNext ? 'font-semibold' : 'font-medium'}`}>
            {fmtDate(s.date)}
          </span>
          <span className="text-[11px] text-muted num">{relative(s.date)}</span>
          {isNext && <span className="pill pill-acc">next</span>}
          {s.number != null && <span className="pill pill-mute num">#{s.number}</span>}
        </div>

        {s.theme && <div className="mt-0.5 text-xs text-muted truncate">{s.theme}</div>}

        {(ownVenue || venuePill) && (
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted">
            {ownVenue && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin size={11} className="flex-shrink-0" />
                {venueMapUrl(ownVenue)
                  ? (
                    <a
                      href={venueMapUrl(ownVenue)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 decoration-border hover:decoration-foreground truncate"
                    >
                      {ownVenue}
                    </a>
                  )
                  : <span className="truncate">{ownVenue}</span>}
              </span>
            )}
            {venuePill && <span className={`pill ${venuePill.cls}`}>{venuePill.label}</span>}
          </div>
        )}

        {showHints && (hostRole || s.notes) && (
          <div className="mt-1 text-[11px] text-muted">
            <span className="font-mono text-[10px] uppercase tracking-wider">dev</span>{' '}
            {hostRole ? `host ${hostRole}.` : ''} {s.notes || ''}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {s.format && s.format !== 'tbd' && (
          <span className="text-xs text-muted hidden sm:inline">{FORMAT_LABEL[s.format]}</span>
        )}
        <span className={`pill ${s.presenter ? 'pill-ok' : 'pill-mute'}`}>
          {s.presenter || 'open'}
        </span>
        {cal && (
          <a
            href={cal}
            target="_blank"
            rel="noreferrer"
            title={`Add ${fmtDate(s.date)} to your calendar`}
            aria-label={`Add ${fmtDate(s.date)} to your calendar`}
            className="tap-target grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-accent transition-colors"
          >
            <CalendarPlus size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
