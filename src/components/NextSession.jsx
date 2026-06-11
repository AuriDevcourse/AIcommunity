import { fmtDateLong, relative, daysBetween, TODAY } from '../lib/dates.js';
import { Mic, MapPin, Ticket, CalendarClock, CalendarPlus, UserCheck } from 'lucide-react';
import Attendees from './Attendees.jsx';
import Rsvp from './Rsvp.jsx';
import { venueMapUrl } from '../lib/venues.js';

const FORMATS = {
  'show-tell':    { label: 'Show & Tell' },
  'lean-coffee':  { label: 'Lean Coffee' },
  'build':        { label: 'Build Together' },
  'skill-share':  { label: 'Skill Share' },
  'tool-explore': { label: 'Tool Exploration' },
  'tbd':          { label: 'Format TBD' },
};

function googleCalendarUrl(session) {
  const dateStr = session.date.replace(/-/g, '');
  const start = `${dateStr}T123000`;
  const end = `${dateStr}T143000`;
  const title = session.theme ? `AI Workshop: ${session.theme}` : 'AI Workshop Session';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    ctz: 'Europe/Copenhagen',
    location: session.venue || '',
    details: session.notes || 'AI Workshop bi-weekly meetup · Copenhagen',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function NextSession({ session }) {
  if (!session) {
    return <div className="card card-pad"><div className="h-section">Next session</div><div className="mt-3 text-muted">No upcoming session scheduled.</div></div>;
  }
  const fmt = FORMATS[session.format] || FORMATS.tbd;
  const days = daysBetween(TODAY, session.date);
  const soon = days <= 1;              // today / tomorrow → strong pill
  const thisWeek = days > 1 && days < 7;
  const lumaUrl = /^https?:\/\//i.test(session.luma || '') ? session.luma : null;

  return (
    <div className="premium-card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <div className="flex items-center gap-1.5 h-section">
              <CalendarClock size={11} strokeWidth={2.2} />
              <span>Next session</span>
            </div>
            <span className={`pill ${soon ? 'pill-acc' : thisWeek ? 'pill-warn' : 'pill-mute'}`}>{relative(session.date)}</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold mt-2 tracking-tight">{fmtDateLong(session.date)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-muted">12:30–14:30 · Copenhagen</span>
            <a
              href={googleCalendarUrl(session)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              <CalendarPlus size={13} strokeWidth={2} /> Add to calendar
            </a>
          </div>
          {session.theme && (
            <div className="mt-3 text-base sm:text-lg font-medium leading-snug tracking-tight text-foreground">{session.theme}</div>
          )}
        </div>
        <div className="flex flex-row sm:flex-col items-end gap-2 flex-shrink-0">
          <span className="pill pill-acc">{fmt.label}</span>
          {session.number && <span className="pill pill-mute num">#{session.number}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 mt-5 text-sm">
        <Field
          icon={Mic}
          label="Presenter"
          value={session.presenter || 'Open slot'}
          muted={!session.presenter}
        />
        <Field
          icon={MapPin}
          label="Venue"
          value={session.venue
            ? (venueMapUrl(session.venue)
              ? <a href={venueMapUrl(session.venue)} target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-border hover:decoration-foreground">{session.venue}</a>
              : session.venue)
            : 'TBD'}
          muted={!session.venue}
        />
        {session.roles?.host && <Field icon={UserCheck} label="Host" value={session.roles.host} />}
      </div>

      {session.notes && (
        <div className="mt-4 text-sm text-muted border-l-2 border-border pl-3 italic">{session.notes}</div>
      )}

      {/* In-dashboard RSVP is the primary call to action. */}
      <Rsvp date={session.date} />

      {/* Google Calendar accepts (secondary signal, shown when available). */}
      <Attendees date={session.date} />

      {lumaUrl && (
        <div className="mt-5">
          <a
            href={lumaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            <Ticket size={14} strokeWidth={2.2} />
            Also on Luma
          </a>
        </div>
      )}
    </div>
  );
}

function Field({ icon: Icon, label, value, muted }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0" title={label}>
      <Icon size={14} strokeWidth={2} className="text-muted mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`truncate ${muted ? 'text-muted' : 'text-foreground'}`}>{value}</span>
      </div>
    </div>
  );
}
