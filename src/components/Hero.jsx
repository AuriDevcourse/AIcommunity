import { useEffect, useState } from 'react';
import { Calendar, Users, CalendarPlus, X, Sparkles } from 'lucide-react';
import { TODAY, fmtDate, relative } from '../lib/dates.js';
import { googleCalendarUrl, sessionStart } from '../lib/session.js';

// Area 2.2 — a countdown is the one number that makes a date feel real. Ticks
// once a minute; a per-second clock would be visual noise for a fortnightly event.
function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const ms = target.getTime() - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  return { days, hours, minutes: mins % 60 };
}

function Stat({ icon: Icon, value, label, hint }) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon size={15} strokeWidth={2} className="text-muted translate-y-0.5" aria-hidden="true" />
      <span className="text-foreground font-semibold num text-lg leading-none">{value}</span>
      <span className="text-sm text-muted">{label}</span>
      {hint && <span className="text-xs text-muted num">· {hint}</span>}
    </div>
  );
}

export default function Hero({ sessions, members, lastNumber, next, cadence, staleDays, onDismissStale }) {
  const start = sessionStart(next, cadence);
  const countdown = useCountdown(start);
  const todayLabel = TODAY.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="mb-8 sm:mb-10">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
        <Calendar size={12} strokeWidth={2} aria-hidden="true" />
        <span>{todayLabel}</span>
      </div>

      {/* Area 2.7 — one fluid step instead of a jump between two fixed sizes. */}
      <h1 className="mt-3 h-display font-semibold">Build with AI. Show what you learned.</h1>

      {/* Area 2.5 — a stranger landing here had no idea what this is. */}
      <p className="mt-3 max-w-2xl text-base text-muted leading-relaxed">
        A Copenhagen meetup that runs every second Sunday. People bring something they built,
        demo it, and the room pulls it apart together — no talks, no slideware.
      </p>

      {/* Areas 2.1 + 2.3 — relevance, then logistics, then one action. */}
      {next && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <a
            href={googleCalendarUrl(next, cadence)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
          >
            <CalendarPlus size={15} strokeWidth={2.2} aria-hidden="true" />
            Add {fmtDate(next.date)} to your calendar
          </a>
          {countdown && (
            <p className="text-sm text-muted">
              <span className="num font-semibold text-foreground">
                {countdown.days > 0
                  ? `${countdown.days}d ${countdown.hours}h`
                  : `${countdown.hours}h ${countdown.minutes}m`}
              </span>{' '}
              until doors
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
        <Stat icon={Calendar} value={sessions.length} label="sessions" hint={lastNumber ? `last #${lastNumber}` : null} />
        <Stat icon={Users} value={members.length} label="members" />
        {next && <Stat icon={Sparkles} value={relative(next.date)} label="next session" />}
      </div>

      {/* Area 2.8 — informational, so it can be dismissed for the session. */}
      {staleDays !== null && (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-foreground">
          <span className="flex-1">
            Session data was last rebuilt <span className="font-semibold num">{staleDays}</span> days ago — run{' '}
            <span className="font-mono">npm run build:data</span> to refresh it.
          </span>
          <button
            onClick={onDismissStale}
            className="flex-shrink-0 rounded p-0.5 text-muted hover:text-foreground"
            aria-label="Dismiss data freshness notice"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
