import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, ImagePlus } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';
import PhotoUploader from './PhotoUploader.jsx';

export default function SessionsGallery({ sessions }) {
  const [uploads, setUploads] = useState({}); // { date: [{url, uploader}] }
  const [showUpload, setShowUpload] = useState(false);

  const loadUploads = useCallback(async () => {
    try {
      const r = await fetch('/api/photos');
      const j = await r.json();
      setUploads(j.byDate || {});
    } catch {
      setUploads({});
    }
  }, []);
  useEffect(() => { loadUploads(); }, [loadUploads]);

  // Merge committed photos (from build) with runtime Blob uploads, by date.
  const byDate = new Map();
  for (const s of sessions) byDate.set(s.date, { ...s, photos: [...(s.photos || [])] });
  for (const [date, items] of Object.entries(uploads)) {
    const entry = byDate.get(date) || { date, number: null, photos: [] };
    entry.photos = [...entry.photos, ...items.map((p) => p.url)];
    byDate.set(date, entry);
  }
  const merged = [...byDate.values()].filter((s) => s.photos.length > 0);
  const sorted = merged.sort((a, b) => b.date.localeCompare(a.date));
  const sessionDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const [open, setOpen] = useState(null);

  const openAt = (sessionIdx, photoIdx) => setOpen({ sessionIdx, photoIdx });

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Archive</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">Sessions</div>
          <p className="mt-2 text-sm text-muted">
            {sorted.length === 0
              ? 'No session photos yet. Add some from a gathering with the button.'
              : `${sorted.length} sessions with photos.`}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-pill px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground hover:text-background transition-colors"
        >
          <ImagePlus size={14} strokeWidth={2.2} />
          Add photos
        </button>
      </div>

      {showUpload && (
        <PhotoUploader
          dates={sessionDates}
          onClose={() => setShowUpload(false)}
          onChanged={loadUploads}
        />
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {sorted.map((session, i) => (
            <SessionTile
              key={session.date}
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
  const name = session.number != null ? `Session #${session.number}` : fmtDate(session.date);

  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        <img
          src={hero}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:contrast-100"
        />
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
        <div className="text-base font-semibold leading-snug tracking-tight">
          {name}
        </div>
      </div>
    </article>
  );
}

function Lightbox({ sessions, state, onChange, onClose }) {
  const session = sessions[state.sessionIdx];
  const photo = session.photos[state.photoIdx];
  const total = session.photos.length;
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    setLoaded(false);
  }, [photo]);

  useEffect(() => {
    const photos = session.photos;
    const ahead = photos[(state.photoIdx + 1) % photos.length];
    const behind = photos[(state.photoIdx - 1 + photos.length) % photos.length];
    [ahead, behind].forEach((src) => {
      if (!src) return;
      const img = new Image();
      img.src = src;
    });
  }, [session, state.photoIdx]);

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
        <div className="relative">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-background/30 border-t-background/90 animate-spin" />
            </div>
          )}
          <img
            src={photo}
            alt=""
            onLoad={() => setLoaded(true)}
            className={`max-h-[80vh] max-w-full rounded-xl object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
        <div className="text-xs text-background/80 num">
          {session.number != null && <>#{session.number} · </>}{fmtDate(session.date)}
          {total > 1 && <> · {state.photoIdx + 1} / {total}</>}
        </div>
      </div>
    </div>
  );
}
