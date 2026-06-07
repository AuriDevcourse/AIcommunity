import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ImagePlus, Pencil, Check, Star, Trash2 } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';
import { authedFetch } from '../lib/supabase.js';
import PhotoUploader from './PhotoUploader.jsx';

export default function SessionsGallery({ sessions }) {
  const [uploads, setUploads] = useState({}); // { date: [{url, uploader}] }
  const [showUpload, setShowUpload] = useState(false);

  // Sessions come from two sources: photos baked into the build (instant) and
  // runtime Blob uploads via /api/photos (async). Hold the grid behind skeletons
  // until both that fetch AND the session-meta fetch settle, so late-arriving
  // sessions (whose photos live only in Blob) don't pop in / shift the layout.
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const loading = !photosLoaded || !metaLoaded;

  const loadUploads = useCallback(async () => {
    try {
      const r = await fetch('/api/photos');
      const j = await r.json();
      setUploads(j.byDate || {});
    } catch {
      setUploads({});
    } finally {
      setPhotosLoaded(true);
    }
  }, []);
  useEffect(() => { loadUploads(); }, [loadUploads]);

  // Runtime per-session overrides ({ name, order }), keyed by date. Obsidian stays
  // the source for rich content; this relabels the tile and orders its photos
  // (first photo = featured cover).
  const [meta, setMeta] = useState({});
  useEffect(() => {
    fetch('/api/session-meta').then((r) => r.json()).then((j) => setMeta(j.names || {})).catch(() => {}).finally(() => setMetaLoaded(true));
  }, []);
  const metaFor = (date) => { const m = meta[date]; return typeof m === 'string' ? { name: m } : (m || {}); };

  async function saveMeta(date, patch) {
    setMeta((m) => {
      const cur = typeof m[date] === 'string' ? { name: m[date] } : { ...(m[date] || {}) };
      for (const [k, v] of Object.entries(patch)) { if (v) cur[k] = v; else delete cur[k]; }
      const next = { ...m };
      if (Object.keys(cur).length) next[date] = cur; else delete next[date];
      return next;
    });
    try {
      await authedFetch('/api/session-meta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...patch }),
      });
    } catch { /* optimistic state already applied */ }
  }
  const defaultName = (s) => (s.number != null ? `Session #${s.number}` : fmtDate(s.date));

  // Merge committed photos (from build) with runtime Blob uploads, by date.
  const byDate = new Map();
  for (const s of sessions) byDate.set(s.date, { ...s, photos: [...(s.photos || [])] });
  for (const [date, items] of Object.entries(uploads)) {
    const entry = byDate.get(date) || { date, number: null, photos: [] };
    entry.photos = [...entry.photos, ...items.map((p) => p.url)];
    byDate.set(date, entry);
  }
  // Apply a saved custom order (first = featured cover); new photos fall in after.
  const applyOrder = (photos, order) => {
    if (!order || !order.length) return photos;
    const set = new Set(photos);
    const known = order.filter((u) => set.has(u));
    const rest = photos.filter((u) => !order.includes(u));
    return [...known, ...rest];
  };

  const merged = [...byDate.values()]
    .filter((s) => s.photos.length > 0)
    .map((s) => ({ ...s, photos: applyOrder(s.photos, metaFor(s.date).order) }));
  const sorted = merged.sort((a, b) => b.date.localeCompare(a.date));
  const sessionDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  const orderedByDate = new Map(merged.map((s) => [s.date, s]));

  const [open, setOpen] = useState(null);
  const openAt = (sessionIdx, photoIdx) => setOpen({ sessionIdx, photoIdx });

  // Session being edited — tracked by date so it reflects live photo changes.
  const [editDate, setEditDate] = useState(null);
  const editing = editDate ? orderedByDate.get(editDate) : null;

  async function deletePhotos(date, urls) {
    const list = urls.filter((u) => u.startsWith('http')); // only runtime uploads are deletable
    for (const url of list) {
      try { await authedFetch(`/api/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' }); } catch { /* reload reflects reality */ }
    }
    await loadUploads();
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-section">Archive</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">Sessions</div>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? 'Loading sessions…'
              : sorted.length === 0
                ? 'No photos yet. Add some with the button.'
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

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12" aria-hidden="true">
          {Array.from({ length: Math.max(sessions.length, 4) }).map((_, i) => (
            <SessionTileSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {sorted.map((session, i) => (
            <SessionTile
              key={session.date}
              session={session}
              name={metaFor(session.date).name || defaultName(session)}
              cover={session.photos[0]}
              onEdit={() => setEditDate(session.date)}
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

      {editing && (
        <SessionEditor
          session={editing}
          name={metaFor(editing.date).name || defaultName(editing)}
          defaultName={defaultName(editing)}
          onRename={(val) => saveMeta(editing.date, { name: val })}
          onReorder={(urls) => saveMeta(editing.date, { order: urls })}
          onDelete={(urls) => deletePhotos(editing.date, urls)}
          onClose={() => setEditDate(null)}
        />
      )}
    </div>
  );
}

function SessionTile({ session, name, cover, onEdit, onOpen }) {
  const date = fmtDate(session.date);

  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        <img
          src={cover}
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

      <div className="mt-4 flex items-center gap-1.5">
        <span className="text-base font-semibold leading-snug tracking-tight truncate">{name}</span>
        <button
          onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1 flex-shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:border-foreground/40 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          aria-label={`Edit ${name}`}
        >
          <Pencil size={12} /> Edit
        </button>
      </div>
    </article>
  );
}

// Placeholder tile shown while photos/meta load — matches SessionTile's footprint
// (4:5 cover + name row) so revealing the real grid causes no layout shift.
function SessionTileSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="skeleton aspect-[4/5] w-full rounded-2xl" />
      <div className="skeleton h-4 w-2/3 mt-4" />
    </div>
  );
}

// Manage a session: rename, drag photos to reorder (first photo = featured cover),
// and multi-select + delete photos (e.g. duplicates). Only runtime uploads (http
// URLs) can be deleted/selected; committed repo photos can still be reordered.
function SessionEditor({ session, name, defaultName, onRename, onReorder, onDelete, onClose }) {
  const [val, setVal] = useState(name);
  useEffect(() => { setVal(name); }, [name]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [dragUrl, setDragUrl] = useState(null);
  const [overUrl, setOverUrl] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);
  useEffect(() => () => savedTimer.current && clearTimeout(savedTimer.current), []);
  const flashSaved = () => {
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1600);
  };
  const photos = session.photos;
  const deletableUrls = photos.filter((u) => u.startsWith('http'));

  // Drop selections whose photos are gone (after a delete + refresh).
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((u) => photos.includes(u)));
      return next.size === s.size ? s : next;
    });
  }, [photos]);

  const saveName = () => {
    const t = val.trim();
    const next = t && t !== defaultName ? t : ''; // empty / default clears the override
    if ((next || defaultName) === name) return; // no change → no flash
    onRename(next);
    flashSaved();
  };
  const toggle = (url) => setSelected((s) => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });
  const allSelected = deletableUrls.length > 0 && selected.size === deletableUrls.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletableUrls));

  // Move a photo to a given index and persist the whole order (first = featured).
  const moveTo = (url, toIdx) => {
    const rest = photos.filter((u) => u !== url);
    onReorder([...rest.slice(0, toIdx), url, ...rest.slice(toIdx)]);
  };
  const onDrop = (targetUrl) => {
    if (dragUrl && dragUrl !== targetUrl) moveTo(dragUrl, photos.indexOf(targetUrl));
    setDragUrl(null);
    setOverUrl(null);
  };

  async function deleteSelected() {
    if (!selected.size || busy) return;
    if (!confirm(`Delete ${selected.size} photo${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBusy(true);
    await onDelete([...selected]);
    setSelected(new Set());
    setBusy(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 h-section"><Pencil size={12} strokeWidth={2.2} /><span>Edit session</span></div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        <label className="block relative">
          <span className="text-[11px] font-medium text-muted">Session name</span>
          <span
            aria-live="polite"
            className={`absolute right-0 top-0 inline-flex items-center gap-1 text-[11px] font-medium text-ok transition-all duration-300 ${savedFlash ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-0.5 pointer-events-none'}`}
          >
            <Check size={12} strokeWidth={2.8} /> Saved
          </span>
          <div className="mt-1 flex gap-2">
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') { saveName(); e.currentTarget.blur(); } }}
              maxLength={80}
              placeholder={defaultName}
              className={`flex-1 min-w-0 bg-background border rounded-md px-3 py-2 text-sm focus:outline-none transition-[border-color,box-shadow] duration-300 ${savedFlash ? 'border-ok ring-2 ring-ok/25' : 'border-border focus:border-foreground'}`}
            />
            <button
              onClick={saveName}
              className={`grid place-items-center w-10 rounded-md text-background transition-all duration-300 hover:scale-[1.03] ${savedFlash ? 'bg-ok' : 'bg-foreground'}`}
              aria-label="Save name"
            >
              <Check size={16} strokeWidth={2.5} className={`transition-transform duration-300 ${savedFlash ? 'scale-125' : ''}`} />
            </button>
          </div>
        </label>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="h-section">Photos · {photos.length}</div>
            {deletableUrls.length > 0 && (
              <button onClick={toggleAll} className="text-xs font-medium text-foreground hover:underline underline-offset-2">
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            )}
          </div>

          {photos.length === 0 ? (
            <p className="text-xs text-muted">No photos in this session.</p>
          ) : (
            <>
              <p className="text-[11px] text-muted mb-2">Drag to reorder — the first photo is the cover (shown larger). Tap the circle to select, the star to feature.</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 grid-flow-dense">
                {photos.map((url, idx) => {
                  const featured = idx === 0;
                  const deletable = url.startsWith('http'); // committed repo photos aren't deletable at runtime
                  const on = selected.has(url);
                  const isDragSource = dragUrl === url;
                  const isOver = overUrl === url && dragUrl && dragUrl !== url;
                  const dimmed = dragUrl && !isDragSource && !isOver; // other photos fade while dragging
                  return (
                    <div
                      key={url}
                      draggable
                      onDragStart={() => setDragUrl(url)}
                      onDragOver={(e) => { e.preventDefault(); if (overUrl !== url) setOverUrl(url); }}
                      onDrop={() => onDrop(url)}
                      onDragEnd={() => { setDragUrl(null); setOverUrl(null); }}
                      className={`group/photo relative aspect-square rounded-lg overflow-hidden border-2 cursor-move transition-all duration-150 ${featured ? 'col-span-2 row-span-2' : ''} ${on ? 'border-err' : featured ? 'border-foreground' : 'border-border'} ${isDragSource ? 'opacity-50 ring-2 ring-foreground scale-[0.97]' : isOver ? 'ring-2 ring-foreground scale-[1.03]' : dimmed ? 'opacity-40' : ''}`}
                    >
                      <img src={url} alt="" loading="lazy" draggable={false} className={`w-full h-full object-cover transition-opacity ${on ? 'opacity-60' : ''}`} />

                      {/* Select circle (deletable photos only) */}
                      {deletable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(url); }}
                          aria-label={on ? 'Deselect photo' : 'Select photo'}
                          aria-pressed={on}
                          className={`absolute left-1 top-1 grid place-items-center w-5 h-5 rounded-full border transition-colors ${on ? 'bg-err border-err text-background' : 'bg-background/80 border-border text-transparent hover:text-muted opacity-100 sm:opacity-0 sm:group-hover/photo:opacity-100'}`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                      )}

                      {/* Featured badge */}
                      {featured && (
                        <span className="absolute left-1 bottom-1 inline-flex items-center gap-1 rounded-full bg-foreground/85 text-background text-[9px] font-medium px-1.5 py-0.5 pointer-events-none">
                          <Star size={9} strokeWidth={2.5} className="fill-current" /> Featured
                        </span>
                      )}

                      {/* Make featured (move to front) — handy on touch where drag is awkward */}
                      {!featured && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTo(url, 0); }}
                          title="Make featured"
                          aria-label="Make featured"
                          className="absolute right-1 top-1 grid place-items-center w-6 h-6 rounded-full bg-background/90 border border-border text-muted hover:text-foreground transition-colors opacity-100 sm:opacity-0 sm:group-hover/photo:opacity-100"
                        >
                          <Star size={12} strokeWidth={2.2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Sticky action bar for the multi-select delete */}
        {selected.size > 0 && (
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 px-6 py-3 border-t border-border bg-background/95 backdrop-blur flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(new Set())} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={deleteSelected}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-err text-background px-4 py-1.5 text-xs font-semibold transition-transform enabled:hover:scale-[1.03] disabled:opacity-50"
              >
                <Trash2 size={13} /> {busy ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
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

  // Preload the neighbouring photos so prev/next swap instantly.
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

  // Touch swipe (mobile): horizontal drag past a threshold flips the photo.
  const touchX = useRef(null);
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    if (touchX.current == null || total < 2) { touchX.current = null; return; }
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
    touchX.current = null;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-foreground/90 backdrop-blur-sm"
      onClick={onClose}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top bar: close */}
      <div className="flex justify-end px-4 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="rounded-full bg-white/90 p-2 text-foreground hover:bg-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image area — fills the remaining height and always fits within it */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-20">
        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-foreground hover:bg-white transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-foreground hover:bg-white transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white/90 animate-spin" />
          </div>
        )}
        <img
          key={photo}
          src={photo}
          alt=""
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onLoad={() => setLoaded(true)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className={`max-h-full max-w-full object-contain rounded-xl select-none transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {/* Bottom bar: mobile nav + counter */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-4 pt-3" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="sm:hidden rounded-full bg-white/90 p-2 text-foreground active:bg-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="text-xs text-background/80 num text-center">
          {session.number != null && <>#{session.number} · </>}{fmtDate(session.date)}
          {total > 1 && <> · {state.photoIdx + 1} / {total}</>}
        </div>
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="sm:hidden rounded-full bg-white/90 p-2 text-foreground active:bg-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
