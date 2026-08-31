import { fmtDateLong, relative, daysBetween, TODAY } from '../lib/dates.js';
import { Mic, MapPin, Ticket, CalendarClock, UserCheck, Video, Download, Coffee } from 'lucide-react';
import Rsvp from './Rsvp.jsx';
import { venueMapUrl } from '../lib/venues.js';
import { icsHref, icsFilename } from '../lib/ics.js';

// Every role a session can carry. Only filled ones render: an empty
// "Timekeeper —" line is noise, and the data usually has one or two set.
const ROLE_LABELS = {
  host: 'Host',
  timekeeper: 'Timekeeper',
  noteTaker: 'Notes',
  demoCurator: 'Demos',
  recapWriter: 'Recap',
};

const FORMATS = {
  'show-tell':    { label: 'Show & Tell' },
  'lean-coffee':  { label: 'Lean Coffee' },
  'build':        { label: 'Build Together' },
  'skill-share':  { label: 'Skill Share' },
  'tool-explore': { label: 'Tool Exploration' },
  'tbd':          { label: 'Format TBD' },
};

export default function NextSession({ session }) {
  if (!session) {
    return <div className="card card-pad"><div className="h-section">Next session</div><div className="mt-3 text-muted">No upcoming session scheduled.</div></div>;
  }
  const fmt = FORMATS[session.format] || FORMATS.tbd;
  const days = daysBetween(TODAY, session.date);
  const soon = days <= 1;              // today / tomorrow → strong pill
  const thisWeek = days > 1 && days < 7;
  const lumaUrl = /^https?:\/\//i.test(session.luma || '') ? session.luma : null;
  const roles = Object.entries(ROLE_LABELS)
    .map(([key, label]) => [label, session.roles?.[key]])
    .filter(([, who]) => Boolean(who));

  // Lean Coffee flag. Nobody records demo signups for a FUTURE session, so the
  // literal "fewer than two demos" cannot be counted: backlog.json is empty and
  // an upcoming entry carries a single `presenter` at most. The honest signal is
  // an undecided format with nobody presenting, which is the condition the
  // planning note itself describes.
  const likelyLeanCoffee = session.format === 'tbd' && !session.presenter;

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
          <div className="mt-0.5">
            <span className="text-sm font-medium text-muted">12:30–14:30 · Copenhagen</span>
          </div>
          {session.theme && (
            <div className="mt-3 text-base sm:text-lg font-medium leading-snug tracking-tight text-foreground">{session.theme}</div>
          )}
        </div>
        <div className="flex flex-row sm:flex-col items-end gap-2 flex-shrink-0">
          <span className="pill pill-acc">{fmt.label}</span>
          {session.number && <span className="pill pill-mute ">#{session.number}</span>}
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
          label="Location"
          value={session.venue
            ? (venueMapUrl(session.venue)
              ? <a href={venueMapUrl(session.venue)} target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-border hover:decoration-foreground">{session.venue}</a>
              : session.venue)
            : 'TBD'}
          muted={!session.venue}
        />
        {roles.map(([label, who]) => (
          <Field key={label} icon={UserCheck} label={label} value={who} />
        ))}
      </dl>

      {likelyLeanCoffee && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-pill px-3.5 py-3">
          <Coffee size={15} strokeWidth={2} className="text-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm leading-snug text-muted">
            <span className="font-medium text-foreground">Likely a Lean Coffee.</span>{' '}
            No presenter yet and the format is open, so we pick topics on the day.
            Want to demo something? Say so and it becomes a Show &amp; Tell.
          </p>
        </div>
      )}

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

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* The hero offers Google Calendar. This is the same event for everyone
            else: Apple Calendar, Outlook, Thunderbird, anything reading .ics.
            Built in the browser as a data: URL, so it needs no endpoint. */}
        <a
          href={icsHref(session)}
          download={icsFilename(session)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          <Download size={14} strokeWidth={2.2} />
          Download .ics
        </a>
        {lumaUrl ? (
          <a
            href={lumaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            <Ticket size={14} strokeWidth={2.2} />
            Also on Luma
          </a>
        ) : import.meta.env.DEV ? (
          /* Maintainer nudge only. A member does not need to know a Luma page is
             missing, and import.meta.env.DEV is false in every build. */
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Ticket size={14} strokeWidth={2.2} />
            <span className="font-mono text-[10px] uppercase tracking-wider">dev</span>
            no Luma link set for this session
          </span>
        ) : null}
      </div>
    </div>
  );
}

// The label used to live only in a `title` attribute, so "Open slot" and "TBD"
// rendered as bare values next to an unlabelled icon, ambiguous by sight, and
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
