import { fmtDate } from '../lib/dates.js';

export default function PastSessions({ sessions, gaps = [] }) {
  // Merge sessions and gaps, sort by date
  const items = [
    ...sessions.map((s) => ({ kind: 'session', date: s.date, payload: s })),
    ...gaps.map((g) => ({ kind: 'gap', date: g.from, payload: g })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Past sessions</div>
        <div className="text-xs text-ink-400 num">{sessions.length} logged</div>
      </div>

      <ol className="mt-4 space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {items.map((it, i) =>
          it.kind === 'session' ? (
            <SessionRow key={`s-${it.payload.number}`} s={it.payload} />
          ) : (
            <GapRow key={`g-${i}`} g={it.payload} />
          )
        )}
      </ol>
    </div>
  );
}

function SessionRow({ s }) {
  const headline =
    s.demos.length > 0
      ? s.demos.map((d) => `${d.presenter}${d.topic ? ` · ${d.topic}` : ''}`).join(' / ')
      : (s.summary?.split('\n')[0] || '—');
  return (
    <li className="flex gap-3 text-sm border-l-2 border-ink-700 pl-3 py-1">
      <span className="num text-ink-400 w-10 flex-shrink-0">#{s.number}</span>
      <span className="num text-ink-500 w-24 flex-shrink-0">{fmtDate(s.date)}</span>
      <span className="flex-1 text-ink-200 truncate" title={headline}>{headline}</span>
      <span className="text-[11px] text-ink-500 num flex-shrink-0">{s.attendees.length} ppl</span>
    </li>
  );
}

function GapRow({ g }) {
  return (
    <li className="flex gap-3 text-sm border-l-2 border-warn/40 pl-3 py-1 bg-warn/5 rounded-r-md">
      <span className="text-warn w-10 flex-shrink-0 text-[11px] uppercase tracking-wider mt-0.5">gap</span>
      <span className="num text-ink-400 w-24 flex-shrink-0">{fmtDate(g.from)} →</span>
      <span className="flex-1 text-ink-300 italic">{g.reason}</span>
    </li>
  );
}
