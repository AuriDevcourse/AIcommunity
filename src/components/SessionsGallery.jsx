import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Images, Users, Mic } from 'lucide-react';
import { fmtDate, fmtDateLong } from '../lib/dates.js';
import { useModal } from '../lib/useModal.js';

export default function SessionsGallery({ sessions, schedule }) {
  const all = (Array.isArray(sessions) ? sessions : []).filter(Boolean);
  // Area 8.1 — the archive previously hid any session without photos, so seven
  // of eight real sessions were invisible. Show them all, newest first.
  const sorted = [...all].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const withPhotos = sorted.filter((s) => Array.isArray(s.photos) && s.photos.length > 0);

  const [open, setOpen] = useState(null);
  // Area 8.10 — a session is a thing you can link someone to.
  const [focused, setFocused] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') : null
  );

  const openAt = useCallback(
    (sessionDate, photoIdx) => {
      const idx = withPhotos.findIndex((s) => s.date === sessionDate);
      if (idx >= 0) setOpen({ sessionIdx: idx, photoIdx });
    },
    [withPhotos]
  );

  // Area 8.8 — the recorded gaps explain why the timeline jumps.
  const gaps = Array.isArray(schedule?.gaps) ? schedule.gaps : [];

  if (sorted.length === 0) {
    return (
      <div className="card card-pad">
        <div className="h-section">Archive</div>
        <p className="mt-3 text-sm text-muted">
          No sessions recorded yet. They are parsed from the markdown notes; drop photos into{' '}
          <span className="font-mono text-foreground">public/sessions/YYYY-MM-DD/</span> and re-run{' '}
          <span className="font-mono text-foreground">npm run build:data</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Archive</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sessions</h2>
        <p className="mt-2 text-sm text-muted">
          {sorted.length} sessions so far · {withPhotos.length} with photos. Drop files into{' '}
          <span className="font-mono">public/sessions/YYYY-MM-DD/</span> to add more.
        </p>
      </div>

      {/* Area 8.8 — a timeline, not just a photo wall. */}
      <ol className="space-y-4">
        {sorted.map((session, i) => {
          const previous = sorted[i + 1];
          const gap = previous ? gapBetween(gaps, previous.date, session.date) : null;
          return (
            <li key={session.number ?? `date-${session.date}`}>
              <SessionRow
                session={session}
                onOpen={(idx) => openAt(session.date, idx)}
                highlighted={focused === session.date}
                onFocusChange={setFocused}
              />
              {gap && (
                <div className="my-3 flex items-center gap-3 pl-1 text-[11px] text-muted">
                  <span className="h-px flex-1 bg-border" />
                  <span className="italic">{gap.reason}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {open && (
        <Lightbox sessions={withPhotos} state={open} onChange={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function gapBetween(gaps, earlier, later) {
  return gaps.find((g) => g.from > earlier && g.to < later) || null;
}

function SessionRow({ session, onOpen, highlighted, onFocusChange }) {
  const photos = Array.isArray(session.photos) ? session.photos : [];
  const demos = Array.isArray(session.demos) ? session.demos : [];
  const attendees = Array.isArray(session.attendees) ? session.attendees : [];
  const hero = photos[0];

  return (
    <article
      id={`session-${session.date}`}
      className={`card card-pad transition-colors ${highlighted ? 'border-foreground' : ''}`}
    >
      <div className="flex flex-col sm:flex-row gap-5">
        {hero ? (
          <button
            type="button"
            onClick={() => onOpen(0)}
            aria-label={`Open ${photos.length} photo${photos.length === 1 ? '' : 's'} from the session on ${fmtDateLong(session.date)}`}
            className="group relative w-full sm:w-56 flex-shrink-0 aspect-video overflow-hidden rounded-xl bg-accent"
          >
            <img
              src={hero}
              alt=""
              loading="lazy"
              decoding="async"
              width={640}
              height={360}
              className="grayscale-hover w-full h-full object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:contrast-100"
            />
            {photos.length > 1 && (
              <span className="absolute left-3 bottom-3 scrim-badge rounded-full px-2.5 py-1 text-[10px] font-medium num inline-flex items-center gap-1">
                <Images size={11} strokeWidth={2.2} aria-hidden="true" />
                {photos.length}
              </span>
            )}
          </button>
        ) : (
          <div className="w-full sm:w-56 flex-shrink-0 aspect-video rounded-xl border border-dashed border-border grid place-items-center text-[11px] text-muted">
            no photos
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{fmtDateLong(session.date)}</h3>
            {session.number != null && <span className="pill pill-mute num">#{session.number}</span>}
            {session.location && <span className="pill pill-ok">{session.location}</span>}
          </div>

          {/* Area 8.2 — demos, attendance and the summary were all parsed and
              then thrown away by the old photo-only view. */}
          {session.summary && (
            <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3">{session.summary}</p>
          )}

          {demos.length > 0 && (
            <div className="mt-3">
              <div className="h-section flex items-center gap-1.5 mb-1">
                <Mic size={11} strokeWidth={2.2} aria-hidden="true" />
                <span>Demos</span>
              </div>
              <ul className="space-y-0.5">
                {demos.map((d, i) => (
                  <li key={`${d.presenter}-${i}`} className="text-sm">
                    <span className="text-foreground font-medium">{d.presenter}</span>
                    {d.topic && <span className="text-muted"> · {d.topic}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {attendees.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} strokeWidth={2.2} aria-hidden="true" />
                <span className="num">{attendees.length}</span> attended
              </span>
            )}
            <button
              onClick={() => {
                const url = `${window.location.pathname}?session=${session.date}${window.location.hash}`;
                window.history.replaceState(null, '', url);
                onFocusChange(session.date);
              }}
              className="hover:text-foreground transition-colors underline underline-offset-2"
            >
              Link to this session
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Lightbox({ sessions, state, onChange, onClose }) {
  const dialogRef = useModal({ open: true, onClose });
  const session = sessions[state.sessionIdx];
  const photos = session.photos;
  const photo = photos[state.photoIdx];
  const total = photos.length;
  const touchX = useRef(null);

  const step = useCallback(
    (delta) => {
      onChange((s) => {
        if (!s) return s;
        const len = sessions[s.sessionIdx].photos.length;
        return { ...s, photoIdx: (s.photoIdx + delta + len) % len };
      });
    },
    [onChange, sessions]
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  // Escape / focus trap / scroll lock come from useModal; only arrows here.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Area 8.3 — decode the neighbours now so stepping through feels instant.
  useEffect(() => {
    for (const delta of [1, -1]) {
      const src = photos[(state.photoIdx + delta + total) % total];
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [state.photoIdx, photos, total]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${state.photoIdx + 1} of ${total} from the session on ${fmtDateLong(session.date)}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
      /* Area 8.4 — on a phone this is a photo viewer; it should swipe. */
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touchX.current = null;
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 scrim-badge rounded-full p-2 transition-opacity hover:opacity-80"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 scrim-badge rounded-full p-2 transition-opacity hover:opacity-80"
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 scrim-badge rounded-full p-2 transition-opacity hover:opacity-80"
            aria-label="Next photo"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <div className="flex flex-col items-center gap-3 max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo}
          alt={`Photo ${state.photoIdx + 1} of ${total} from the session on ${fmtDate(session.date)}`}
          decoding="async"
          className="max-h-[70vh] max-w-full rounded-xl object-contain"
        />

        {/* Area 8.6 — jump straight to a frame instead of clicking through. */}
        {total > 1 && (
          <div className="flex gap-1.5 max-w-full overflow-x-auto tabs-scroll py-1">
            {photos.map((p, i) => (
              <button
                key={p}
                onClick={() => onChange((s) => ({ ...s, photoIdx: i }))}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === state.photoIdx}
                className={`h-12 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${
                  i === state.photoIdx
                    ? 'border-overlay-foreground opacity-100'
                    : 'border-transparent opacity-55 hover:opacity-90'
                }`}
              >
                <img src={p} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Area 8.5 */}
        <div className="text-xs text-overlay-foreground num text-center">
          {session.number != null && <>#{session.number} · </>}
          {fmtDate(session.date)}
          {total > 1 && <> · {state.photoIdx + 1} / {total}</>}
          <span className="hidden sm:inline"> · ← → to move, Esc to close</span>
        </div>
      </div>
    </div>
  );
}
