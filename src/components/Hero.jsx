import { useEffect, useMemo, useState } from 'react';
import { TriangleAlert, X, ArrowRight } from 'lucide-react';
import { TODAY, fmtDate, fmtToday, formatCountdown, sessionStart, sessionTimeRange } from '../lib/dates.js';

const DISMISS_KEY = 'aiw.staleScheduleDismissed';

/** How long after the start time the session still reads as "in progress". */
const LIVE_WINDOW_MS = 2.5 * 3600000;
/** Beyond a week out, "13 days" never changes mid-visit, so do not tick at all. */
const TICK_HORIZON_MS = 7 * 86400000;

/**
 * Self-scheduling countdown. A recursive setTimeout rather than setInterval so
 * the cadence can tighten as the session approaches: every second inside the
 * last hour, every minute before that, and no timer at all when the session is
 * more than a week away or long finished.
 *
 * Takes a timestamp, not a Date, because a fresh Date object every render would
 * re-run the effect every render.
 */
function useCountdown(startsAtMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startsAtMs) return undefined;
    let id;
    const schedule = () => {
      const remaining = startsAtMs - Date.now();
      if (remaining > TICK_HORIZON_MS || remaining < -LIVE_WINDOW_MS) return;
      id = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, remaining > 0 && remaining < 3600000 ? 1000 : 60000);
    };
    setNow(Date.now());
    schedule();
    return () => clearTimeout(id);
  }, [startsAtMs]);

  return startsAtMs ? startsAtMs - now : null;
}

/** One stat. Numerals first: the value is the thing you read, the label sits under it. */
function Stat({ value, label, sub }) {
  return (
    <div className="min-w-0">
      <div className="num text-2xl sm:text-3xl font-semibold tracking-tight leading-none">{value}</div>
      <dt className="h-section mt-2">{label}</dt>
      {sub && <dd className="text-xs text-muted mt-1 truncate">{sub}</dd>}
    </div>
  );
}

/**
 * Home only. The masthead used to render on every tab, which stacked it on top
 * of each tab's own header. The at-a-glance band shows where
 * it has something to be at a glance about.
 *
 * Deliberately NOT a card: NextSession sits directly below it on home, and two
 * stacked cards read as two competing headlines. A hairline band keeps this
 * attached to the hero.
 */
export default function Hero({ showGlance = false, next, sessionCount = 0, memberCount = 0, scheduleStatus = 'loading', recentPhotos = [], onOpenPhotos }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  // Memoised on the identifying fields, so the countdown effect keys off a
  // stable number instead of a new Date on every render.
  const startsAtMs = useMemo(() => {
    const d = next ? sessionStart(next) : null;
    return d ? d.getTime() : null;
  }, [next?.date, next?.startsAt]);

  const remaining = useCountdown(startsAtMs);
  // The date matters: beyond two days out formatCountdown defers to the calendar-day
  // count, which is what the next-session pill shows. Without it the two disagree.
  const parts = formatCountdown(remaining, next?.date);
  const live = remaining !== null && remaining <= 0 && remaining > -LIVE_WINDOW_MS;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* nothing to persist to */ }
  };

  // Only a configured-but-unreadable calendar is stale. An unconfigured one is
  // just local development, and warning about it would cry wolf every session.
  const showStale = showGlance && scheduleStatus === 'stale' && !dismissed;

  return (
    <section className="mb-8 sm:mb-10">
      <h1 className="hero-title font-semibold tracking-tight max-w-4xl">
        A Copenhagen community that meets every two weeks to build with AI, then shows the work.
      </h1>
      {/* What a session IS, and who it is for. The page described the logistics of
          the NEXT session but never the recurring shape, so a first-time visitor
          could not tell what they would walk into or whether they would be out of
          place. Every comparable community answers both in its first screen. */}
      <p className="mt-2 text-sm text-muted max-w-3xl leading-relaxed">
        Two and a half hours on a Sunday. Someone shows what they built, or we pick topics on the day and
        work through them together. Engineers, designers, founders and students, anyone building
        with AI. Free to attend, and you never have to present.
      </p>

      <div className="mt-5 sm:mt-6 rounded-2xl border border-border overflow-hidden">
        {/* Two pieces of art, not one inverted piece. The old band was a
            greyscale line drawing that dark mode faked with a CSS invert; the
            brand ships a real light and a real dark version, and inverting
            those would turn the green horizon magenta. Swapped by the same
            token-level rule the lockup uses, so the correct one paints on the
            first frame. */}
        <img
          src="/brand/hero-light.webp"
          alt=""
          width="2400"
          height="420"
          fetchpriority="high"
          decoding="async"
          className="hero-art hero-art--light w-full h-20 sm:h-44 object-cover"
        />
        <img
          src="/brand/hero-dark.webp"
          alt=""
          width="2400"
          height="420"
          decoding="async"
          className="hero-art hero-art--dark w-full h-20 sm:h-44 object-cover"
        />
      </div>

      {showGlance && (
        <>
          {showStale && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-accent px-3.5 py-3">
              <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-warn" aria-hidden />
              <p className="flex-1 text-xs text-muted leading-relaxed">
                The live calendar could not be reached, so these dates come from the last saved copy and may be out of date.
              </p>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss out-of-date schedule notice"
                className="tap-target flex items-center justify-center -m-1 p-1 rounded-md text-muted hover:text-foreground transition-colors"
              >
                <X size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}

          <div className="mt-5 sm:mt-6 border-t border-border pt-5">
            <p className="text-xs text-muted">Today is {fmtToday(TODAY)}</p>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <dl className="flex flex-wrap items-start gap-y-5 [&>*+*]:border-l [&>*+*]:border-border [&>*+*]:pl-6 sm:[&>*+*]:pl-10 [&>*]:pr-6 sm:[&>*]:pr-10 [&>*:last-child]:pr-0">
                {next ? (
                  <Stat
                    value={
                      live ? 'Now'
                        : parts ? parts.map((p) => `${p.n} ${p.u}`).join(' ')
                        : fmtDate(next.date)
                    }
                    label={live ? 'Session in progress' : 'Until the next session'}
                    sub={`${fmtDate(next.date)}, ${sessionTimeRange()}`}
                  />
                ) : (
                  <Stat value="None" label="Next session" sub="Nothing scheduled yet" />
                )}
                <Stat value={sessionCount} label="Sessions held" />
                <Stat value={memberCount} label="Members" />
              </dl>

              {/* The Add-to-calendar button used to live here while the session card
                  offered a .ics link, so the same intent was answered twice in two
                  places and neither mentioned the other. Both options now sit on the
                  card, next to the session they add. */}
            </div>
          </div>
        </>
      )}

      {/* Proof the room is real. The archive holds ~70 photos across 7 sessions
          and the landing page showed none of them, while every comparable
          community leads with faces. A strip, not a gallery: it answers "is this
          a real thing with real people" in one glance and then gets out of the
          way of the next-session card. */}
      {recentPhotos.length > 0 && (
        <button
          type="button"
          onClick={onOpenPhotos}
          aria-label="See photos from our sessions"
          className="group mt-6 block w-full text-left"
        >
          <span className="flex gap-2 overflow-hidden rounded-xl">
            {recentPhotos.map((src, i) => (
              <span
                key={src}
                /* Two on a phone, four from sm up: a fifth thumbnail on a narrow
                   screen makes every face too small to read. */
                className={`group/thumb relative block flex-1 aspect-[4/3] overflow-hidden rounded-lg bg-accent ${i > 1 ? 'hidden sm:block' : ''}`}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/thumb:scale-[1.04]"
                />
              </span>
            ))}
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted group-hover:text-foreground transition-colors">
            Photos from our sessions
            <ArrowRight size={13} strokeWidth={2.2} />
          </span>
        </button>
      )}
    </section>
  );
}
