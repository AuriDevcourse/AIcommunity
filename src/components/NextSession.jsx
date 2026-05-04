import { fmtDateLong, relative, parseDate, TODAY, daysBetween, fmtDate } from '../lib/dates.js';

const FORMATS = {
  'show-tell':    { label: 'Show & Tell' },
  'lean-coffee':  { label: 'Lean Coffee' },
  'build':        { label: 'Build Together' },
  'skill-share':  { label: 'Skill Share' },
  'tool-explore': { label: 'Tool Exploration' },
  'tbd':          { label: 'Format TBD' },
};

const LIFECYCLE = [
  { offset: -7, label: 'T-7', who: 'Host',          action: 'Announce in WhatsApp + Luma' },
  { offset: -3, label: 'T-3', who: 'Host',          action: 'Confirm venue' },
  { offset: -2, label: 'T-2', who: 'Demo curator',  action: 'Lock format · Lean Coffee if <2 demos' },
  { offset: -1, label: 'T-1', who: 'Host',          action: 'WhatsApp reminder + access info' },
  { offset:  0, label: 'T-0', who: 'Everyone',      action: 'Run session · notes · 1 photo' },
  { offset:  1, label: 'T+1', who: 'Recap-writer',  action: 'WhatsApp recap (3 bullets)' },
  { offset:  2, label: 'T+2', who: 'Recap-writer',  action: 'LinkedIn post' },
  { offset:  3, label: 'T+3', who: 'Host',          action: 'File session note · seed next' },
];

const ROLES = [
  { key: 'host',         label: 'Host' },
  { key: 'timekeeper',   label: 'Timekeeper' },
  { key: 'noteTaker',    label: 'Note-taker' },
  { key: 'demoCurator',  label: 'Demo curator' },
  { key: 'recapWriter',  label: 'Recap-writer' },
];

function stepDate(sessionIso, offset) {
  const d = parseDate(sessionIso);
  d.setDate(d.getDate() + offset);
  return d;
}

function stepStatus(sessionIso, offset) {
  const stepDay = stepDate(sessionIso, offset);
  const stepIso = stepDay.toISOString().slice(0, 10);
  const todayIso = TODAY.toISOString().slice(0, 10);
  if (stepIso === todayIso) return 'today';
  if (stepDay < TODAY) return 'past';
  return 'future';
}

export default function NextSession({ session, backlog }) {
  if (!session) {
    return <div className="card card-pad"><div className="h-section">Next session</div><div className="mt-3 text-ink-400">No upcoming session scheduled.</div></div>;
  }
  const fmt = FORMATS[session.format] || FORMATS.tbd;
  const queued = backlog.filter((b) => b.status === 'queued').length;
  const roles = session.roles || {};

  const t2Date = stepDate(session.date, -2);
  const t2Passed = t2Date < TODAY;
  const leanCoffeeFlag = t2Passed && queued < 2 && session.format === 'tbd';

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-section">Next session</div>
          <div className="text-2xl font-semibold mt-1">{fmtDateLong(session.date)}</div>
          <div className="text-accent text-sm font-medium mt-0.5">{relative(session.date)} · 12:30–14:30</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="pill pill-acc">{fmt.label}</span>
          {session.number && <span className="pill pill-mute num">#{session.number}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
        <Field label="Theme" value={session.theme || '—'} />
        <Field label="Presenter" value={session.presenter || 'open'} />
        <Field label="Venue" value={session.venue || '—'} status={session.venueStatus} />
        <Field label="Luma" value={session.luma ? 'created' : 'not yet'} />
      </div>

      {session.notes && (
        <div className="mt-4 text-sm text-ink-300 border-l-2 border-ink-700 pl-3 italic">{session.notes}</div>
      )}

      {leanCoffeeFlag && (
        <div className="mt-4 p-3 rounded-lg border border-warn/40 bg-warn/10 text-sm">
          <span className="font-semibold text-warn">Lean Coffee suggested:</span>{' '}
          <span className="text-ink-200">It's past Friday and fewer than 2 demos are queued. Default to Lean Coffee — propose topics, dot-vote, time-box.</span>
        </div>
      )}

      <div className="mt-5">
        <div className="h-section mb-2">Lifecycle</div>
        <ol className="space-y-1">
          {LIFECYCLE.map((step) => {
            const status = stepStatus(session.date, step.offset);
            const date = stepDate(session.date, step.offset);
            const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const cls =
              status === 'today'  ? 'bg-accent/10 border-accent/40 text-ink-100' :
              status === 'past'   ? 'border-ink-800 text-ink-500' :
                                    'border-ink-700/60 text-ink-200';
            return (
              <li key={step.offset} className={`flex items-center gap-3 text-sm border rounded-md px-2.5 py-1.5 ${cls}`}>
                <span className="num text-[11px] w-9 flex-shrink-0 opacity-70">{step.label}</span>
                <span className="num text-[11px] w-20 flex-shrink-0 opacity-70">{dateStr}</span>
                <span className="flex-1">{step.action}</span>
                <span className="text-[11px] opacity-60 flex-shrink-0">{step.who}</span>
                {status === 'today' && <span className="pill pill-acc text-[10px]">today</span>}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-5">
        <div className="h-section mb-2">Roles for this session</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {ROLES.map((r) => (
            <div key={r.key} className="flex items-center justify-between border-b border-ink-800/60 py-1">
              <span className="text-ink-400 text-xs">{r.label}</span>
              <span className={roles[r.key] ? 'text-ink-100' : 'text-warn text-xs italic'}>
                {roles[r.key] || 'open'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, status }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 text-ink-100 flex items-center gap-2">
        <span>{value}</span>
        {status === 'open' && <span className="pill pill-warn">open</span>}
        {status === 'tentative' && <span className="pill pill-warn">tentative</span>}
        {status === 'confirmed' && <span className="pill pill-ok">confirmed</span>}
      </div>
    </div>
  );
}
