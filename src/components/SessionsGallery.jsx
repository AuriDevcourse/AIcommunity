import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Pencil, Check, Star, Trash2, ArrowUpRight, MessagesSquare } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';
import { authedFetch } from '../lib/supabase.js';
import PhotoUploader from './PhotoUploader.jsx';

export default function SessionsGallery({ sessions, onOpenRecap }) {
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
  const fallbackName = (s) => (s.number != null ? `Session #${s.number}` : fmtDate(s.date));
  // Display name priority: a REAL custom rename (one that differs from the generic
  // "Session #N") → the curated title (note's **Title:**) → "Session #N". Old junk
  // overrides literally equal to "Session #N" are ignored so the title shows.
  const displayName = (s) => {
    const fb = fallbackName(s);
    const override = metaFor(s.date).name?.trim();
    if (override && override !== fb) return override;
    return s.title?.trim() || fb;
  };
  const defaultName = displayName;

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

  // Show EVERY session (with or without photos) so the recap + topics are always
  // reachable. Photo-less sessions get a placeholder cover that opens the recap.
  const merged = [...byDate.values()]
    .map((s) => ({ ...s, photos: applyOrder(s.photos, metaFor(s.date).order) }));
  const sorted = merged.sort((a, b) => b.date.localeCompare(a.date));
  const sessionDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  const orderedByDate = new Map(merged.map((s) => [s.date, s]));

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
                ? 'No sessions yet.'
                : `${sorted.length} sessions.`}
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
          {sorted.map((session) => (
            <SessionTile
              key={session.date}
              session={session}
              name={displayName(session)}
              cover={session.photos[0]}
              onEdit={() => setEditDate(session.date)}
              onRecap={onOpenRecap ? () => onOpenRecap(session.date) : null}
            />
          ))}
        </div>
      )}

      {editing && (
        <SessionEditor
          session={editing}
          name={displayName(editing)}
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

function SessionTile({ session, name, cover, onEdit, onRecap }) {
  const date = fmtDate(session.date);
  const hasPhotos = session.photos.length > 0;
  const topicCount = session.topics?.length || 0;

  return (
    <article className="group relative flex flex-col">
      <button
        type="button"
        // The whole cover opens the session recap. The featured cover photo itself
        // is changed via the Edit button (reorder / set featured).
        onClick={() => onRecap?.()}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        {hasPhotos ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:contrast-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted bg-accent">
            <MessagesSquare size={26} strokeWidth={1.6} />
            <span className="text-xs font-semibold text-foreground">View recap</span>
            {topicCount > 0 && (
              <span className="text-[10px] font-medium num">{topicCount} topics</span>
            )}
          </div>
        )}
        <span className="absolute right-4 bottom-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium num text-foreground">
          {date}
        </span>
        {hasPhotos && session.photos.length > 1 && (
          <span className="absolute left-4 bottom-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium num text-foreground">
            {session.photos.length} photos
          </span>
        )}
      </button>

      {/* Edit overlays the cover's top-right. Sibling (not nested) so it doesn't
          conflict with the cover button; lifts on hover/focus. */}
      <button
        onClick={onEdit}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:bg-white transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Edit ${name}`}
      >
        <Pencil size={12} strokeWidth={2.4} /> Edit
      </button>

      <div className="mt-4 flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-snug tracking-tight line-clamp-2 min-w-0">{name}</span>
        {onRecap && (
          <button
            onClick={onRecap}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground transition-colors flex-shrink-0"
            aria-label={`Open recap for ${name}`}
          >
            Recap <ArrowUpRight size={13} strokeWidth={2.2} />
          </button>
        )}
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-2xl" onClick={(e) => e.stopPropagation()}>
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
          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-4 px-5 sm:px-6 py-3 border-t border-border bg-background/95 backdrop-blur flex items-center justify-between gap-3">
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
