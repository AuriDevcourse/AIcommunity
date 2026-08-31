import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Link2, Check, PenLine, Users, Mic, MapPin, CalendarDays, ImageOff, Wrench, MessagesSquare, ExternalLink, Info, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { fmtDateLong, fmtDate } from '../lib/dates.js';

// Public, shareable recap of a single past session: cover, who came, what was
// demoed, the photo gallery. Reached via the hash route #recap/<date> (no auth to
// view). Post creation is handed off to the Post maker tool, not drafted inline.
export default function SessionRecap({ date, sessions, onBack }) {
  const committed = useMemo(() => (sessions || []).find((s) => s.date === date) || null, [sessions, date]);
  const [uploads, setUploads] = useState([]); // runtime Blob photos for this date
  const [name, setName] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/photos').then((r) => r.json()).catch(() => ({})),
      fetch('/api/session-meta').then((r) => r.json()).catch(() => ({})),
    ]).then(([photos, meta]) => {
      if (!alive) return;
      const byDate = photos?.byDate?.[date] || [];
      setUploads(byDate.map((p) => p.url));
      const m = (meta?.names || {})[date];
      setName(typeof m === 'string' ? m : (m?.name || null));
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [date]);

  const photos = useMemo(() => {
    const base = committed?.photos ? [...committed.photos] : [];
    const extra = uploads.filter((u) => !base.includes(u));
    return [...base, ...extra];
  }, [committed, uploads]);

  // Same name chain as the Sessions gallery so the recap title matches the tile:
  // a REAL custom rename (differs from "Session #N") → curated title → "Session #N".
  // A junk override equal to "Session #N" is ignored so the title shows.
  const fallback = committed?.number != null ? `Session #${committed.number}` : fmtDate(date);
  const override = name?.trim();
  const title = (override && override !== fallback) ? override : (committed?.title?.trim() || fallback);

  // Cover = the featured (first) photo, baked into data.json so it's known on first
  // paint. Fixed (not random) so the browser can cache it and it loads eagerly.
  const cover = committed?.photos?.[0] || photos[0];

  // Photo lightbox (in-page overlay), null when closed, else the open photo index.
  const [lightbox, setLightbox] = useState(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const PHOTO_PREVIEW = 6;

  // Hide a placeholder "TBD" location so the recap header doesn't read "… · TBD".
  const place = committed?.location && committed.location.trim().toUpperCase() !== 'TBD' ? committed.location.trim() : '';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
        <ArrowLeft size={15} strokeWidth={2.2} /> Back to sessions
      </button>

      <header className="mt-5">
        <div className="flex items-center gap-2 h-section">
          <CalendarDays size={11} strokeWidth={2.2} />
          <span>Session recap</span>
          {committed?.number != null && <span className="pill pill-mute ">#{committed.number}</span>}
        </div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{fmtDateLong(date)} · Copenhagen{place ? ` · ${place}` : ''}</p>
        <RecapActions date={date} />
      </header>

      {/* Cover, the featured photo, loaded eagerly so it's there right away */}
      {cover && (
        <div className="mt-6 rounded-2xl overflow-hidden border border-border bg-accent">
          <img src={cover} alt="" loading="eager" fetchpriority="high" decoding="async" className="w-full max-h-[460px] object-cover" />
        </div>
      )}

      {/* About */}
      {committed?.summary && (
        <section className="mt-8">
          <div className="text-base leading-relaxed text-foreground whitespace-pre-line">{committed.summary}</div>
        </section>
      )}

      {/* Topics, what we talked about, split into themes */}
      {committed?.topics?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <MessagesSquare size={11} strokeWidth={2.2} /><span>What we talked about</span>
            <span className="pill pill-mute ml-1">{committed.topics.length}</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {committed.topics.map((t, i) => (
              <div key={i} className="warm-card card-pad flex gap-3">
                <div className="mt-0.5 shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-accent text-foreground">
                  <MessagesSquare size={14} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug">{t.title}</div>
                  {t.summary && <div className="text-sm text-muted mt-1 leading-relaxed">{t.summary}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Demos */}
      {committed?.demos?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section"><Mic size={11} strokeWidth={2.2} /><span>What we demoed</span></div>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {committed.demos.map((d, i) => (
              <li key={i} className="warm-card card-pad flex gap-3">
                <div className="mt-0.5 shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-accent text-foreground">
                  <Mic size={14} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug">{d.topic}</div>
                  <div className="text-xs text-muted mt-0.5">by {d.presenter}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Attendees */}
      {committed?.attendees?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <Users size={11} strokeWidth={2.2} /><span>Who came</span>
            <span className="pill pill-mute ml-1">{committed.attendees.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {committed.attendees.map((a) => <span key={a} className="pill">{a}</span>)}
          </div>
        </section>
      )}

      {/* Tools & ideas discussed */}
      {committed?.tools?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <Wrench size={11} strokeWidth={2.2} /><span>Tools & ideas discussed</span>
            <span className="pill pill-mute ml-1">{committed.tools.length}</span>
          </div>
          <ToolChips tools={committed.tools} />
        </section>
      )}

      {/* Photo gallery */}
      <section className="mt-8">
        <div className="flex items-center gap-1.5 h-section"><MapPin size={11} strokeWidth={2.2} /><span>Photos</span>
          {photos.length > 0 && <span className="pill pill-mute ml-1">{photos.length}</span>}
        </div>
        {!loaded ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-xl" />)}
          </div>
        ) : photos.length === 0 ? (
          <div className="empty-state mt-3 flex flex-col items-center gap-2">
            <ImageOff size={18} strokeWidth={2} />
            <span>No photos for this session yet.</span>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(showAllPhotos ? photos : photos.slice(0, PHOTO_PREVIEW)).map((url, i) => (
                <button key={url} type="button" onClick={() => setLightbox(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`} className="block aspect-square overflow-hidden rounded-xl border border-border bg-accent group">
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </button>
              ))}
            </div>
            {photos.length > PHOTO_PREVIEW && !showAllPhotos && (
              <button onClick={() => setShowAllPhotos(true)} className="btn btn-sm btn-ghost mt-3">
                See more <ChevronDown size={14} strokeWidth={2.2} /> <span className=" text-muted">({photos.length - PHOTO_PREVIEW})</span>
              </button>
            )}
          </>
        )}
      </section>

      {lightbox != null && (
        <PhotoLightbox photos={photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

// In-page photo viewer: keyboard (Esc / arrows), prev/next, click-outside to close.
function PhotoLightbox({ photos, index, onIndex, onClose }) {
  const total = photos.length;
  const next = useCallback(() => onIndex((index + 1) % total), [index, total, onIndex]);
  const prev = useCallback(() => onIndex((index - 1 + total) % total), [index, total, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  // Fetch the neighbouring photos while this one is on screen, so paging feels
  // instant. Both sides, not just forward: the arrows and the thumbnail strip
  // page backwards just as often.
  useEffect(() => {
    if (total < 2) return;
    for (const i of [(index + 1) % total, (index - 1 + total) % total]) {
      const img = new Image();
      img.src = photos[i];
    }
  }, [index, total, photos]);

  // Plan 8.6. The active thumbnail scrolls itself into view, so paging with the
  // arrows keeps the strip in sync instead of leaving the highlight off-screen.
  // `block: 'nearest'` confines the scroll to the strip; without it the whole
  // overlay is dragged around under the photo.
  const stripRef = useRef(null);
  useEffect(() => {
    const active = stripRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [index]);

  // Swipe. Only a clearly horizontal drag pages the photo, a vertical scroll or
  // a diagonal flick must not flip the image out from under a thumb.
  const touchStart = useRef(null);
  // A touch that moved is a gesture, not a tap on the backdrop. The browser fires
  // a click right after such a touch ends, which would hit the overlay's
  // click-to-dismiss and close the viewer mid-swipe. That one click is swallowed.
  //
  // Timestamped rather than a plain flag: a flag left standing after the gesture
  // also eats the next real tap, so dismissing after a swipe would take two.
  const dragEndedAt = useRef(0);

  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) dragEndedAt.current = Date.now();
    if (total < 2) return;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next(); else prev();
  };

  // Only the click a gesture just produced is ignored; anything later is a
  // deliberate tap on the backdrop and closes the viewer.
  const onBackdropClick = () => {
    if (Date.now() - dragEndedAt.current < 400) return;
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onBackdropClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        // Horizontal drags belong to the photo viewer, not the browser. Without
        // this, a right-swipe near the left edge is the platform's back gesture,
        // so paging back would navigate off the recap page instead.
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
      }}
    >
      <div className="flex justify-end px-4 shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-full chip-on-media p-2 transition-colors" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-20">
        {total > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 rounded-full chip-on-media p-2.5 transition-colors" aria-label="Previous">
              <ChevronLeft size={22} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 rounded-full chip-on-media p-2.5 transition-colors" aria-label="Next">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <img
          src={photos[index]}
          alt={`Session photo ${index + 1} of ${total}`}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain rounded-xl select-none"
        />
      </div>

      {total > 1 && (
        <div className="shrink-0 pt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-4">
            {/* The side arrows are desktop-only, so touch needs its own controls.
                Without these, a phone could only ever see the first photo. */}
            <button onClick={prev} className="sm:hidden rounded-full chip-on-media p-2.5 transition-colors" aria-label="Previous photo">
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs text-white/80 num tabular-nums">{index + 1} / {total}</span>
            <button onClick={next} className="sm:hidden rounded-full chip-on-media p-2.5 transition-colors" aria-label="Next photo">
              <ChevronRight size={20} />
            </button>
            {/* Plan 8.5. The keys have worked since this viewer was written and
                nothing said so. Pointer-only, because a touch device has no keys
                to press and the hint would be a lie. */}
            <span aria-hidden className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="inline-flex items-center">
                <ChevronLeft size={12} strokeWidth={2.4} />
                <ChevronRight size={12} strokeWidth={2.4} />
              </span>
              <span>to move</span>
              <span>·</span>
              <span>Esc to close</span>
            </span>
            {/* The visual hint is two icons and a separator, which a screen reader
                announces as "to move Esc to close" and never names a key. Spell it
                out once, for AT only. */}
            <span className="sr-only">Use the left and right arrow keys to move between photos, Escape to close.</span>
          </div>

          {/* Plan 8.6. Thumbnail strip. Paging one photo at a time is the only way
              to reach #14 of 18 without it. One tab stop, not `total` of them: the
              active thumb is the only focusable one (roving tabindex) and the
              arrow keys, already bound above, move the selection. */}
          <div
            ref={stripRef}
            role="group"
            aria-label="Session photos"
            /* The overlay pages the photo on a horizontal swipe and sets
               touch-action: pan-y to claim that gesture from the browser. Both
               would make this strip unscrollable on touch, so it takes pan-x
               back and keeps its own touches to itself. */
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1 justify-start sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
          >
            {photos.map((url, i) => {
              const active = i === index;
              return (
                <button
                  key={url}
                  type="button"
                  data-active={active}
                  aria-current={active ? 'true' : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onIndex(i)}
                  aria-label={`Photo ${i + 1} of ${total}`}
                  className={`relative shrink-0 h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-md transition-opacity ${
                    active ? 'opacity-100 ring-2 ring-white' : 'opacity-45 hover:opacity-80'
                  }`}
                >
                  <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// Tools discussed. A tool with a website renders as a link (opens the site); one
// without shows an info dot and reveals "what it does" inline when clicked (so the
// note is reachable on touch, where hover tooltips don't exist).
function ToolChips({ tools }) {
  const [openIdx, setOpenIdx] = useState(null);
  const open = openIdx != null ? tools[openIdx] : null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tools.map((t, i) =>
        t.url ? (
          <a
            key={i}
            href={t.url}
            target="_blank"
            rel="noreferrer"
            title={t.note || undefined}
            className="pill inline-flex items-center gap-1 hover:bg-foreground hover:text-background transition-colors"
          >
            {t.name}
            <ExternalLink size={11} strokeWidth={2.2} className="opacity-70" />
          </a>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            title={t.note || undefined}
            aria-expanded={openIdx === i}
            className={`pill inline-flex items-center gap-1 ${openIdx === i ? 'bg-foreground text-background' : ''}`}
          >
            {t.name}
            {t.note && <Info size={11} strokeWidth={2.2} className="opacity-60" />}
          </button>
        ),
      )}
      {open?.note && (
        <div className="w-full mt-1 text-xs text-muted card card-pad">
          <span className="font-medium text-foreground">{open.name}:</span> {open.note}
        </div>
      )}
    </div>
  );
}

// Hero actions for a recap: copy the link, and hand off to the Post maker tool
// (Tools tab) with this session preselected, post writing happens there, not here.
function RecapActions({ date }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/#recap/${date}` : '';

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  function createPost() {
    // Handoff: the Post maker reads this on mount, preselects the session, clears it.
    try { sessionStorage.setItem('postmaker.session', date); } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.location.hash = 'tools';
  }

  return (
    <div data-print="hide" className="mt-5 flex flex-wrap items-center gap-2">
      <button onClick={copyLink} className="btn btn-sm btn-ghost">
        {copied ? <Check size={14} strokeWidth={2.4} className="text-ok" /> : <Link2 size={14} strokeWidth={2.2} />}
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <button onClick={createPost} className="btn btn-sm btn-primary">
        <PenLine size={14} strokeWidth={2.2} /> Create a social media post
      </button>
    </div>
  );
}
