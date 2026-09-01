import { History, ArrowUpRight } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';

// What the community actually talked about, on the landing page.
//
// This replaced Schedule ahead, which listed one future date the Next session
// card had already covered in full. Past topics do work that a future date
// cannot: they show a stranger the level and the subject matter, which is the
// question "is this for me" that the hero can only assert an answer to.
//
// Deliberately terse. Titles only, no summaries: three sessions at a glance,
// then the archive. A visitor who wants the detail clicks through.
const MAX_SESSIONS = 3;
const MAX_TOPICS = 4;

export default function RecentSessions({ sessions = [], onOpenRecap }) {
  const recent = [...sessions]
    .filter((s) => (s.topics || []).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_SESSIONS);

  // Nothing worth showing until a session has been written up. Better absent
  // than a panel explaining that it is empty.
  if (recent.length === 0) return null;

  return (
    <div className="card card-pad">
      <h2 className="flex items-center gap-1.5 h-section">
        <History size={11} strokeWidth={2.2} />
        <span>What we talked about</span>
      </h2>

      <ul className="mt-3 flex flex-col divide-y divide-border">
        {recent.map((s) => {
          const topics = s.topics || [];
          const shown = topics.slice(0, MAX_TOPICS);
          const rest = topics.length - shown.length;
          return (
            <li key={s.date} className="py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => onOpenRecap?.(s.date)}
                disabled={!onOpenRecap}
                aria-label={`Open the recap for ${s.title || fmtDate(s.date)}`}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold leading-snug min-w-0 group-hover:underline underline-offset-2">
                    {s.title || fmtDate(s.date)}
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0 text-[11px] text-muted num">
                    {fmtDate(s.date)}
                    {onOpenRecap && <ArrowUpRight size={12} strokeWidth={2.2} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" />}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {shown.map((t) => (
                    <span key={t.title} className="pill pill-mute">{t.title}</span>
                  ))}
                  {rest > 0 && <span className="pill pill-mute">+{rest} more</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
