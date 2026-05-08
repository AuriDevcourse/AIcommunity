import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';

export default function SessionsGallery({ sessions }) {
  const withPhotos = sessions.filter((s) => Array.isArray(s.photos) && s.photos.length > 0);
  const sorted = [...withPhotos].sort((a, b) => b.date.localeCompare(a.date));

  const [open, setOpen] = useState(null);

  const openAt = (sessionIdx, photoIdx) => setOpen({ sessionIdx, photoIdx });

  return (
    <div className="space-y-10">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Archive</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">Sessions</div>
        <p className="mt-2 text-sm text-muted">
          {sorted.length === 0
            ? 'No session photos yet. Drop files into public/sessions/<number>/ to populate this view.'
            : `${sorted.length} sessions with photos.`}
        </p>
      </div>

      {sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {sorted.map((session, i) => (
            <SessionTile
              key={session.number}
              session={session}
              onOpen={(photoIdx) => openAt(i, photoIdx)}
            />
          ))}
        </div>
      )}

      {open && (
        <Lightbox
          sessions={sorted}
          state={open}
          onChange={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function SessionTile({ session, onOpen }) {
  const hero = session.photos[0];
  const date = fmtDate(session.date);
  const headline =
    session.demos.length > 0
      ? session.demos.map((d) => `${d.presenter}${d.topic ? ' · ' + d.topic : ''}`).join(' / ')
      : (session.summary?.split('\n')[0] || '');

  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        <img
          src={hero}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:contrast-100"
        />
        {session.number != null && (
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground num">
            #{session.number}
          </span>
        )}
        <span className="absolute right-4 bottom-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium num text-foreground">
          {date}
        </span>
        {session.photos.length > 1 && (
          <span className="absolute left-4 bottom-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium num text-foreground">
            {session.photos.length} photos
          </span>
        )}
      </button>

      <div className="mt-4">
        <div className="text-base font-semibold leading-snug tracking-tight truncate" title={headline}>
          {headline || (session.number != null ? `Session #${session.number}` : fmtDate(session.date))}
        </div>
        {session.attendees.length > 0 && (
          <p className="text-xs text-muted mt-1">{session.attendees.length} attendees</p>
        )}
      </div>
    </article>
  );
}

function Lightbox({ sessions, state, onChange, onClose }) {
  const session = sessions[state.sessionIdx];
  const photo = session.photos[state.photoIdx];
  const total = session.photos.length;

  const next = useCallback(() => {
    onChange((s) => s && {
      ...s,
      photoIdx: (s.photoIdx + 1) % sessions[s.sessionIdx].photos.length,
    });
  }, [onChange, sessions]);

  const prev = useCallback(() => {
    onChange((s) => s && {
      ...s,
      photoIdx: (s.photoIdx - 1 + sessions[s.sessionIdx].photos.length) % sessions[s.sessionIdx].photos.length,
    });
  }, [onChange, sessions]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/90 p-2 text-foreground hover:bg-white transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground hover:bg-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground hover:bg-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <div
        className="flex flex-col items-center gap-3 max-h-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={photo} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
        <div className="text-xs text-background/80 num">
          {session.number != null && <>#{session.number} · </>}{fmtDate(session.date)}
          {total > 1 && <> · {state.photoIdx + 1} / {total}</>}
        </div>
      </div>
    </div>
  );
}
