import { fmtDateLong, relative, TODAY } from '../lib/dates.js';
import {
  Sparkles, Mic, MapPin, Ticket, CalendarClock, CalendarPlus, Download,
  ExternalLink, Coffee, Users,
} from 'lucide-react';
import {
  resolveCadence, googleCalendarUrl, downloadIcs, lifecycle, leanCoffeeFallback,
} from '../lib/session.js';

const FORMATS = {
  'show-tell': { label: 'Show & Tell' },
  'lean-coffee': { label: 'Lean Coffee' },
  build: { label: 'Build Together' },
  'skill-share': { label: 'Skill Share' },
  'tool-explore': { label: 'Tool Exploration' },
  tbd: { label: 'Format TBD' },
};

const ROLE_LABELS = {
  host: 'Host',
  timekeeper: 'Timekeeper',
  noteTaker: 'Note taker',
  demoCurator: 'Demo curator',
  recapWriter: 'Recap writer',
};

export default function NextSession({ session, cadence, backlog }) {
  const slot = resolveCadence(cadence);

  if (!session) {
    return (
      <div className="card card-pad">
        <div className="flex items-center gap-1.5 h-section">
          <CalendarClock size={11} strokeWidth={2.2} aria-hidden="true" />
          <span>Next session</span>
        </div>
        <div className="mt-3 rounded-lg border border-warn/40 bg-warn/5 p-4">
          <div className="text-lg font-semibold tracking-tight text-foreground">No session scheduled</div>
          <p className="mt-1 text-sm text-muted">
            Every planned date has passed. Add the next one to{' '}
            <span className="font-mono text-foreground">data/schedule.json</span>, then re-run{' '}
            <span className="font-mono text-foreground">npm run build:data</span>.
          </p>
        </div>
      </div>
    );
  }

  const fmt = FORMATS[session.format] || FORMATS.tbd;
  const phase = lifecycle(session, TODAY);
  const leanCoffee = leanCoffeeFallback(session, backlog);
  const roles = Object.entries(session.roles || {}).filter(([, who]) => who);

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 h-section">
            <CalendarClock size={11} strokeWidth={2.2} aria-hidden="true" />
            <span>Next session</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold mt-1 tracking-tight">{fmtDateLong(session.date)}</h2>
          <div className="text-sm font-medium text-muted mt-0.5">
            {relative(session.date)} · {slot.startTime}–{slot.endTime}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 flex-shrink-0">
          <span className="pill pill-acc">{fmt.label}</span>
          {session.number && <span className="pill pill-mute num">#{session.number}</span>}
          {/* Area 3.3 */}
          {phase && <span className={`pill pill-${phase.tone}`}>{phase.label}</span>}
        </div>
      </div>

      {/* Area 3.9 — states the framework rule instead of leaving it in a README. */}
      {leanCoffee && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-accent px-3 py-2 text-xs text-foreground">
          <Coffee size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-muted" aria-hidden="true" />
          <span>
            Fewer than two demos queued, so this falls back to{' '}
            <span className="font-semibold">Lean Coffee</span> unless the backlog fills up. Format is
            decided on the Friday before.
          </span>
        </div>
      )}

      {/* Areas 3.1 + 3.2 — labels are now rendered, and an unset value says what
          to do rather than showing a bare dash. */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-5">
        <Field icon={Sparkles} label="Theme" value={session.theme} empty="Not set yet" />
        <Field icon={Mic} label="Presenter" value={session.presenter} empty="Looking for one" />
        <Field
          icon={MapPin}
          label="Venue"
          value={session.venue}
          empty="Not booked"
          status={session.venueStatus}
          href={session.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${session.venue}, Copenhagen`)}` : null}
        />
        <Field
          icon={Ticket}
          label="Luma event"
          value={session.luma ? 'Open the event page' : ''}
          empty="Not created"
          href={session.luma || null}
        />
      </dl>

      {/* Area 3.6 — roles were in the data all along and never rendered. */}
      {roles.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="h-section flex items-center gap-1.5 mb-2">
            <Users size={11} strokeWidth={2.2} aria-hidden="true" />
            <span>Roles</span>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
            {roles.map(([key, who]) => (
              <li key={key} className="text-sm">
                <span className="text-muted">{ROLE_LABELS[key] || key}: </span>
                <span className="text-foreground font-medium">{who}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {session.notes && (
        <p className="mt-4 text-sm text-muted border-l-2 border-border pl-3 italic">{session.notes}</p>
      )}

      {/* Area 3.7 — one primary action, secondary actions clearly subordinate. */}
      <div className="mt-6 flex flex-wrap items-center gap-2 no-print">
        <a
          href={googleCalendarUrl(session, cadence)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
        >
          <CalendarPlus size={14} strokeWidth={2.2} aria-hidden="true" />
          Google Calendar
        </a>
        {/* Area 3.8 */}
        <button
          type="button"
          onClick={() => downloadIcs(session, cadence)}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          <Download size={14} strokeWidth={2.2} aria-hidden="true" />
          .ics file
        </button>
        {session.luma && (
          <a
            href={session.luma}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
            RSVP on Luma
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, empty, status, href }) {
  const isSet = Boolean(value);
  const body = (
    <span className={isSet ? 'text-foreground' : 'text-muted italic'}>{isSet ? value : empty}</span>
  );

  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon size={15} strokeWidth={2} className="text-muted mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-[0.14em] text-muted font-semibold">{label}</dt>
        <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
          {href && isSet ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground hover:underline underline-offset-2 inline-flex items-center gap-1"
            >
              {value}
              <ExternalLink size={11} strokeWidth={2.2} className="text-muted" aria-hidden="true" />
            </a>
          ) : (
            body
          )}
          {status === 'open' && <span className="pill pill-warn flex-shrink-0">open</span>}
          {status === 'tentative' && <span className="pill pill-warn flex-shrink-0">tentative</span>}
          {status === 'confirmed' && <span className="pill pill-ok flex-shrink-0">confirmed</span>}
        </dd>
      </div>
    </div>
  );
}
