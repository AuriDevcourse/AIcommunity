import { fmtDateLong, relative } from '../lib/dates.js';
import { Sparkles, Mic, MapPin, Ticket, CalendarClock, CalendarPlus } from 'lucide-react';

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
  const title = session.theme ? `AI Workshop — ${session.theme}` : 'AI Workshop Session';
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

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 h-section">
            <CalendarClock size={11} strokeWidth={2.2} />
            <span>Next session</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold mt-1 tracking-tight">{fmtDateLong(session.date)}</div>
          <div className="text-sm font-medium text-muted mt-0.5">{relative(session.date)} · 12:30–14:30</div>
        </div>
        <div className="flex flex-row sm:flex-col items-end gap-2 flex-shrink-0">
          <span className="pill pill-acc">{fmt.label}</span>
          {session.number && <span className="pill pill-mute num">#{session.number}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-5 text-sm">
        <Field icon={Sparkles} label="Theme" value={session.theme || '—'} />
        <Field icon={Mic} label="Presenter" value={session.presenter || 'open'} />
        <Field icon={MapPin} label="Venue" value={session.venue || '—'} status={session.venueStatus} />
        <Field icon={Ticket} label="Luma" value={session.luma ? 'created' : 'not yet'} />
      </div>

      {session.notes && (
        <div className="mt-4 text-sm text-muted border-l-2 border-border pl-3 italic">{session.notes}</div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={googleCalendarUrl(session)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
        >
          <CalendarPlus size={14} strokeWidth={2.2} />
          Add to calendar
        </a>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, status }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0" title={label}>
      <Icon size={14} strokeWidth={2} className="text-muted mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-2 text-foreground">
        <span className="truncate">{value}</span>
        {status === 'open' && <span className="pill pill-warn flex-shrink-0">open</span>}
        {status === 'tentative' && <span className="pill pill-warn flex-shrink-0">tentative</span>}
        {status === 'confirmed' && <span className="pill pill-ok flex-shrink-0">confirmed</span>}
      </div>
    </div>
  );
}
