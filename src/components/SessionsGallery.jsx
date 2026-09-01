import { useEffect, useState, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Pencil, Check, Star, Trash2, ArrowUpRight, MessagesSquare, ChevronDown, ChevronUp, History, CircleSlash } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';
import { writeJson } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useDialog } from '../lib/useDialog.js';
import PhotoUploader from './PhotoUploader.jsx';
import { fetchPhotos } from '../lib/photos.js';

export default function SessionsGallery({ sessions, gaps = [], onOpenRecap }) {
  const [uploads, setUploads] = useState({}); // { date: [{url, uploader}] }
  const [showUpload, setShowUpload] = useState(false);

  // Who is allowed to change anything. This mirrors guardMutation on the server
  // exactly: with Supabase configured a write needs a signed-in user, without it
  // the app is in its typed-name fallback mode and the server allows the write,
  // so the UI has to allow it too. While auth is still resolving, assume NOT
  // allowed, or every visitor gets a flash of Edit buttons that then vanish.
  const { enabled: authEnabled, user, loading: authLoading, openAuth } = useAuth();
  const canEdit = authEnabled ? (!authLoading && Boolean(user)) : true;

  // Sessions come from two sources: photos baked into the build (instant) and
  // runtime Blob uploads via /api/photos (async). Hold the grid behind skeletons
  // until both that fetch AND the session-meta fetch settle, so late-arriving
  // sessions (whose photos live only in Blob) don't pop in / shift the layout.
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const loading = !photosLoaded || !metaLoaded;

  // A failure here empties only the sessions whose photos live in Blob, which
  // reads as data loss rather than as a missing API. Say so on the page.
  const [uploadsError, setUploadsError] = useState('');
  const loadUploads = useCallback(async () => {
    try {
      const { byDate } = await fetchPhotos();
      setUploads(byDate);
      setUploadsError('');
    } catch (e) {
      setUploads({});
      setUploadsError(e?.message || 'Uploaded photos could not be loaded.');
      console.warn('[photos]', e?.message || e);
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

  // Optimistic, but only until the server disagrees. Snapshot just this date so a
  // rollback cannot clobber an unrelated edit that landed in between.
  async function saveMeta(date, patch) {
    const before = meta[date];
    setMeta((m) => {
      const cur = typeof m[date] === 'string' ? { name: m[date] } : { ...(m[date] || {}) };
      for (const [k, v] of Object.entries(patch)) { if (v) cur[k] = v; else delete cur[k]; }
      const next = { ...m };
      if (Object.keys(cur).length) next[date] = cur; else delete next[date];
      return next;
    });
    const r = await writeJson('/api/session-meta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ...patch }),
    });
    if (!r.ok) {
      setMeta((m) => {
        const next = { ...m };
        if (before === undefined) delete next[date]; else next[date] = before;
        return next;
      });
    }
    return r;
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

  // Session being edited, tracked by date so it reflects live photo changes.
  const [editDate, setEditDate] = useState(null);
  const editing = editDate ? orderedByDate.get(editDate) : null;

  async function deletePhotos(date, urls) {
    const list = urls.filter((u) => u.startsWith('http')); // only runtime uploads are deletable
    let failure = null;
    for (const url of list) {
      const r = await writeJson(`/api/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
      if (!r.ok && !failure) failure = r; // report the first refusal, keep trying the rest
    }
    await loadUploads(); // the reload is the rollback: whatever survived comes back
    return failure || { ok: true };
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-section">Archive</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sessions</h1>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? 'Loading sessions…'
              : sorted.length === 0
                ? 'No sessions yet.'
                : `${sorted.length} sessions.`}
          </p>
        </div>
        {/* Contributing photos is the point of this page, so a signed-out visitor
            still sees the invitation, it just routes to sign-in instead of to an
            uploader whose every request would come back 401. */}
        <button
          onClick={() => (canEdit ? setShowUpload(true) : openAuth())}
          data-print="hide"
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-pill px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground hover:text-background transition-colors"
        >
          <ImagePlus size={14} strokeWidth={2.2} />
          {canEdit ? 'Add photos' : 'Sign in to add photos'}
        </button>
      </div>

      {uploadsError && !loading && (
        <div role="status" data-print="hide" className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          Uploaded photos could not be loaded, so any session whose photos are uploads only looks
          empty. Photos committed to the repo are unaffected. {uploadsError}
        </div>
      )}

      {showUpload && (
        <PhotoUploader
          dates={sessionDates}
          onClose={() => setShowUpload(false)}
          onChanged={loadUploads}
        />
      )}

      {!loading && sorted.length > 0 && (
        <ArchiveTimeline
          sessions={sorted}
          gaps={gaps}
          nameOf={displayName}
          onRecap={onOpenRecap}
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
              onEdit={canEdit ? () => setEditDate(session.date) : null}
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

// Plan 8.8. The grid answers "what did we do", in reverse date order, four tiles
// to a row. It cannot show *rhythm*: that #04 and #05 sit six months apart, or
// that a stretch of 2026 went unlogged. This does, on one rail, oldest first.
//
// The gaps come from data/schedule.json and are the only record that those weeks
// happened at all. Dropping them would quietly claim the community paused.
//
// Collapsed by default. The photo grid is what people come to this tab for, and
// a timeline unfurled above it would push the tiles below the fold.
function ArchiveTimeline({ sessions, gaps, nameOf, onRecap }) {
  const [open, setOpen] = useState(false);

  // Oldest first: a timeline that runs backwards reads as a list, not a span.
  const asc = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (asc.length < 2) return null; // one session is not a timeline

  // Sessions and gaps on one chronological rail. A gap sorts by where it starts,
  // which lands it between the session before it and the one after.
  const items = [
    ...asc.map((s) => ({ kind: 'session', key: s.date, at: s.date, session: s })),
    ...gaps.map((g) => ({ kind: 'gap', key: `gap-${g.from}-${g.to}`, at: g.from, gap: g })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const span = `${monthYear(asc[0].date)} to ${monthYear(asc[asc.length - 1].date)}`;
  const withPhotos = asc.filter((s) => s.photos.length > 0).length;

  return (
    <section className="card card-pad">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="h-section flex items-center gap-1.5"><History size={11} strokeWidth={2.2} />Timeline</span>
          <span className="mt-1 block text-sm text-muted">
            {asc.length} sessions, {span}
            {gaps.length > 0 && ` · ${gaps.length} recorded ${gaps.length === 1 ? 'gap' : 'gaps'}`}
          </span>
        </span>
        <span className="flex-shrink-0 text-muted">
          {open ? <ChevronUp size={16} strokeWidth={2.2} /> : <ChevronDown size={16} strokeWidth={2.2} />}
        </span>
      </button>

      {open && (
        <ol className="mt-5 space-y-0">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return item.kind === 'gap' ? (
              <li key={item.key} className="relative pl-6 pb-5">
                {/* Dashed rail: the break in the record is the point. */}
                {!isLast && <span aria-hidden className="absolute left-[5px] top-1 bottom-0 w-0 border-l border-dashed border-border" />}
                <span aria-hidden className="absolute left-0 top-1 grid place-items-center w-[11px] h-[11px] text-muted">
                  <CircleSlash size={11} strokeWidth={2.2} />
                </span>
                <div className="text-xs font-medium text-muted">
                  Unlogged, {monthYear(item.gap.from)} to {monthYear(item.gap.to)}
                </div>
                {item.gap.reason && <div className="mt-0.5 text-[11px] text-muted">{item.gap.reason}</div>}
              </li>
            ) : (
              <li key={item.key} className="relative pl-6 pb-5 last:pb-0">
                {!isLast && <span aria-hidden className="absolute left-[5px] top-2 bottom-0 w-0 border-l border-border" />}
                <span aria-hidden className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-foreground bg-background" />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs text-muted num tabular-nums">{fmtDate(item.session.date)}</span>
                  {item.session.number != null && (
                    <span className="text-[11px] text-muted">#{String(item.session.number).padStart(2, '0')}</span>
                  )}
                  {onRecap ? (
                    <button
                      type="button"
                      onClick={() => onRecap(item.session.date)}
                      className="text-sm font-medium text-foreground hover:underline underline-offset-2 text-left"
                    >
                      {nameOf(item.session)}
                    </button>
                  ) : (
                    <span className="text-sm font-medium">{nameOf(item.session)}</span>
                  )}
                  {item.session.photos.length > 0 && (
                    <span className="text-[11px] text-muted num tabular-nums">{item.session.photos.length} photos</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {open && (
        <p className="mt-1 text-[11px] text-muted">
          {withPhotos} of {asc.length} sessions have photos.
        </p>
      )}
    </section>
  );
}

// "Jun 2025". Short enough to sit inside a sentence, unambiguous across years.
function monthYear(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
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
            decoding="async"
            /* 4:5 tile, the intrinsic ratio stops the grid reflowing per image. */
            width={512}
            height={640}
            className="w-full h-full object-cover object-top grayscale contrast-[1.05] transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:contrast-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted bg-accent">
            <MessagesSquare size={26} strokeWidth={1.6} />
            <span className="text-xs font-semibold text-foreground">View recap</span>
            {topicCount > 0 && (
              <span className="text-[10px] font-medium ">{topicCount} topics</span>
            )}
          </div>
        )}
        <span className="absolute right-4 bottom-4 rounded-full chip-on-media px-2.5 py-1 text-[10px] font-medium ">
          {date}
        </span>
        {hasPhotos && session.photos.length > 1 && (
          <span className="absolute left-4 bottom-4 rounded-full chip-on-media px-2.5 py-1 text-[10px] font-medium ">
            {session.photos.length} photos
          </span>
        )}
      </button>

      {/* Edit overlays the cover's top-right. Sibling (not nested) so it doesn't
          conflict with the cover button; lifts on hover/focus. Absent, not
          disabled, for anyone who cannot use it: the server refuses their write
          anyway, so offering the control only wastes their time. */}
      {onEdit && (
        <button
          onClick={onEdit}
          data-print="hide"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full chip-on-media px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Edit ${name}`}
        >
          <Pencil size={12} strokeWidth={2.4} /> Edit
        </button>
      )}

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

// Placeholder tile shown while photos/meta load, matches SessionTile's footprint
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
  const panelRef = useDialog(onClose);
  const titleId = useId();
  const [savedFlash, setSavedFlash] = useState(false);
  // Whatever the server said when it refused. Cleared on the next attempt.
  const [actionError, setActionError] = useState('');
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

  const saveName = async () => {
    const t = val.trim();
    const next = t && t !== defaultName ? t : ''; // empty / default clears the override
    if ((next || defaultName) === name) return; // no change → no flash
    setActionError('');
    const r = await onRename(next);
    if (r && r.ok === false) {
      setActionError(r.error);
      setVal(name); // the parent rolled the name back; put the field back with it
      return;
    }
    flashSaved();
  };
  const toggle = (url) => setSelected((s) => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });
  const allSelected = deletableUrls.length > 0 && selected.size === deletableUrls.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletableUrls));

  // Move a photo to a given index and persist the whole order (first = featured).
  const moveTo = async (url, toIdx) => {
    const rest = photos.filter((u) => u !== url);
    setActionError('');
    const r = await onReorder([...rest.slice(0, toIdx), url, ...rest.slice(toIdx)]);
    if (r && r.ok === false) setActionError(r.error);
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
    setActionError('');
    const r = await onDelete([...selected]);
    if (r && r.ok === false) setActionError(r.error);
    setSelected(new Set());
    setBusy(false);
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-panel max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="flex items-center gap-1.5 h-section"><Pencil size={12} strokeWidth={2.2} /><span>Edit session</span></h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        {actionError && (
          <div role="alert" className="mb-4 rounded-lg bg-err/10 px-3 py-2 text-xs text-err">
            {actionError}
          </div>
        )}

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
              <p className="text-[11px] text-muted mb-2">Drag to reorder. The first photo becomes the cover. Tap the circle to select, the star to feature.</p>
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

                      {/* Make featured (move to front), handy on touch where drag is awkward */}
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
