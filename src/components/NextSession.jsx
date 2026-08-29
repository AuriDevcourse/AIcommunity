import { fmtDateLong, relative, daysBetween, TODAY } from '../lib/dates.js';
import { Mic, MapPin, Ticket, CalendarClock, CalendarPlus, UserCheck, Video } from 'lucide-react';
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

      <dl className="flex flex-col gap-2.5 mt-5 text-sm">
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
      </dl>

      {session.notes && (
        <div className="mt-4 text-sm text-muted border-l-2 border-border pl-3 italic">{session.notes}</div>
      )}

      {/* Standing reminder: sessions are recorded; everyone names themselves before speaking. */}
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-pill px-3.5 py-3">
        <Video size={15} strokeWidth={2} className="text-foreground mt-0.5 flex-shrink-0" />
        <p className="text-sm leading-snug text-foreground">
          <span className="font-medium">Sessions are recorded.</span>{' '}
          <span className="text-muted">Before you speak, say your name (about 10 seconds), then carry on.</span>
        </p>
      </div>

      {/* One RSVP control + unified "Coming" list (in-app RSVPs + calendar accepts). */}
      <Rsvp date={session.date} />

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

// The label used to live only in a `title` attribute, so "Open slot" and "TBD"
// rendered as bare values next to an unlabelled icon — ambiguous by sight, and
// invisible to a screen reader, which reads the icon as nothing at all. Now a
// real description list: the label is visible text and programmatically tied to
// its value.
function Field({ icon: Icon, label, value, muted }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon size={14} strokeWidth={2} className="text-muted mt-[3px] flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
        <dt className="text-[11px] uppercase tracking-[0.13em] text-muted font-semibold">{label}</dt>
        <dd className={`m-0 min-w-0 truncate ${muted ? 'text-muted' : 'text-foreground'}`}>{value}</dd>
      </div>
    </div>
  );
}
