import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, ImagePlus, Check, ArrowRight } from 'lucide-react';

const NAME_KEY = 'aiworkshop_voter_name';
const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Downscale in the browser so payloads stay small and uploads are fast/reliable.
function downscale(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ data: dataUrl.split(',')[1], contentType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image (HEIC is not supported, use JPG/PNG)')); };
    img.src = url;
  });
}

// POST the downscaled image to our endpoint via XHR so we get real upload progress.
function uploadViaXHR({ date, name, file, onProgress }) {
  return new Promise((resolve, reject) => {
    downscale(file).then(({ data, contentType }) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/photos');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        try {
          const j = JSON.parse(xhr.responseText || '{}');
          if (xhr.status < 300 && j.ok) resolve(j);
          else reject(new Error(j.error || `upload failed (${xhr.status})`));
        } catch { reject(new Error('bad server response')); }
      };
      xhr.onerror = () => reject(new Error('network error'));
      xhr.send(JSON.stringify({ date, name, filename: file.name, contentType, data }));
    }).catch(reject);
  });
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// Sessions run every 2 weeks. Roll the cadence forward from the most recent
// recorded session to the latest session date that's already happened (on/before
// today) — that's the one you're most likely uploading photos for. If none has
// happened since the last record, fall back to today.
function nextSessionDate(dates) {
  const base = dates[0]; // dates arrive sorted newest-first
  if (!base) return todayIso();
  const today = todayIso();
  const cur = new Date(`${base}T12:00:00`);
  let best = null;
  for (let i = 0; i < 60; i++) {
    cur.setDate(cur.getDate() + 14);
    const iso = cur.toISOString().slice(0, 10);
    if (iso > today) break;
    best = iso;
  }
  return best || today;
}

export default function PhotoUploader({ dates, onClose, onChanged }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'move'
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const initialNew = dates.length === 0;
  const [newMode, setNewMode] = useState(initialNew); // pick a brand-new session date
  const [date, setDate] = useState(initialNew ? nextSessionDate(dates) : dates[0]);
  const [queue, setQueue] = useState([]); // {file, status, pct, url}
  const [configured, setConfigured] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // We only need to know whether Blob is connected; the modal no longer lists the
  // whole standing gallery (it shows just what you uploaded this session).
  useEffect(() => {
    let active = true;
    fetch('/api/photos')
      .then((r) => r.json())
      .then((j) => { if (active) setConfigured(j.configured !== false); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function addFiles(list) {
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    if (files.length) setQueue(files.map((file) => ({ file, status: 'pending', pct: 0 })));
  }

  async function doUpload() {
    if (!name.trim() || queue.length === 0) return;
    localStorage.setItem(NAME_KEY, name.trim());
    for (let i = 0; i < queue.length; i++) {
      setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'uploading', pct: 0 } : x)));
      try {
        const res = await uploadViaXHR({
          date,
          name: name.trim(),
          file: queue[i].file,
          onProgress: (pct) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, pct } : x))),
        });
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'done', pct: 100, url: res.url } : x)));
      } catch (err) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'error', err: err.message } : x)));
      }
    }
    onChanged?.();
  }

  // Delete a photo you just uploaded this session (undo a mistake).
  async function removeUploaded(url) {
    if (!confirm('Remove this photo?')) return;
    await fetch(`/api/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    setQueue((q) => q.filter((x) => x.url !== url));
    onChanged?.();
  }

  const done = queue.filter((q) => q.status === 'done').length;
  const uploadedItems = queue.filter((q) => q.status === 'done' && q.url);
  const uploading = queue.some((q) => q.status === 'uploading');
  const overall = queue.length ? Math.round(queue.reduce((s, q) => s + (q.status === 'done' ? 100 : q.pct || 0), 0) / queue.length) : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 h-section"><ImagePlus size={12} strokeWidth={2.2} /><span>Add photos</span></div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        {!configured && (
          <div className="text-sm text-warn mb-4">Uploads aren't connected yet. Add a Vercel Blob store (see docs/photos-setup.md).</div>
        )}

        {/* Tabs: upload new photos, or move existing ones between sessions */}
        <div className="flex gap-1 p-1 mb-4 rounded-full bg-pill border border-border text-sm">
          {[['upload', 'Upload'], ['move', 'Move photos']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 rounded-full py-1.5 font-medium transition-colors ${mode === key ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'move' && <MovePhotos dates={dates} configured={configured} onChanged={onChanged} />}

        {mode === 'upload' && (
        <>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (tagged on each photo)"
            maxLength={48}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Session</span>
              {dates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (newMode) { setNewMode(false); setDate(dates[0] || todayIso()); }
                    else { setNewMode(true); setDate(nextSessionDate(dates)); }
                  }}
                  className="text-xs font-medium text-foreground hover:underline underline-offset-2"
                >
                  {newMode ? 'Pick existing' : '+ New session date'}
                </button>
              )}
            </div>
            {newMode ? (
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
              />
            ) : (
              <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                {dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
                {!dates.includes(date) && <option value={date}>{fmtDate(date)}</option>}
              </select>
            )}
            {newMode && <p className="text-[11px] text-muted">Suggested: next session, 2 weeks after the last one. Change it if needed. Number and details stay in Obsidian.</p>}
          </div>

          <div
            onClick={() => configured && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (configured) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (configured) addFiles(e.dataTransfer.files); }}
            className={`w-full rounded-lg border border-dashed py-6 text-center text-sm transition-colors ${
              dragOver ? 'border-foreground bg-accent text-foreground' : 'border-border bg-pill text-muted hover:border-foreground hover:text-foreground'
            } ${configured ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
          >
            {queue.length ? `${queue.length} selected` : 'Drop photos here, or click to choose'}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />

          {queue.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {queue.map((q, i) => (
                <li key={i} className="text-muted">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{q.file.name}</span>
                    <span className={`num ${q.status === 'done' ? 'text-ok' : q.status === 'error' ? 'text-err' : ''}`}>
                      {q.status === 'uploading' ? `${q.pct}%` : q.status === 'done' ? 'done' : q.status}
                    </span>
                  </div>
                  {(q.status === 'uploading' || q.status === 'done') && (
                    <div className="mt-1 h-1 rounded-full bg-accent overflow-hidden">
                      <div className="h-full bg-foreground transition-[width] duration-200" style={{ width: `${q.status === 'done' ? 100 : q.pct}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={doUpload}
            disabled={!configured || !name.trim() || queue.length === 0 || uploading}
            className="w-full rounded-full bg-foreground text-background py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <Upload size={14} strokeWidth={2.2} />
            {uploading ? `Uploading ${overall}%` : done === queue.length && queue.length ? 'Uploaded' : `Upload${queue.length ? ` ${queue.length}` : ''}`}
          </button>
          {configured && queue.length > 0 && !name.trim() && (
            <p className="text-xs text-warn text-center">Enter your name above to upload.</p>
          )}
          {queue.length > 0 && done === queue.length && (
            <p className="text-xs text-ok text-center">Uploaded to sessions/{date}/</p>
          )}
        </div>

        {uploadedItems.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="h-section mb-2">Uploaded this session · {uploadedItems.length}</div>
            <div className="grid grid-cols-4 gap-2">
              {uploadedItems.map((p) => (
                <div key={p.url} className="relative group aspect-square">
                  <img src={p.url} alt="" className="w-full h-full object-cover rounded-md border border-border" />
                  <button
                    onClick={() => removeUploaded(p.url)}
                    className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-1 text-muted hover:text-err opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>,
    document.body
  );
}

// Move uploaded photos from one session to another (e.g. photos misfiled to the
// wrong session before "new session by date" existed). Only runtime uploads can
// move; committed repo photos aren't listed here.
function MovePhotos({ dates, configured, onChanged }) {
  const [source, setSource] = useState(dates[0] || '');
  const [photos, setPhotos] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [targetNew, setTargetNew] = useState(false);
  const [target, setTarget] = useState(nextSessionDate(dates));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = async (d) => {
    setPhotos(null); setSelected(new Set());
    try {
      const r = await fetch('/api/photos');
      const j = await r.json();
      setPhotos((j.byDate && j.byDate[d]) || []);
    } catch {
      setPhotos([]);
    }
  };
  useEffect(() => { if (source) load(source); }, [source]);

  const toggle = (url) => setSelected((s) => {
    const next = new Set(s);
    next.has(url) ? next.delete(url) : next.add(url);
    return next;
  });
  const allSelected = photos && photos.length > 0 && selected.size === photos.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set((photos || []).map((p) => p.url)));

  async function doMove() {
    if (!selected.size || !target || target === source || busy) return;
    setBusy(true);
    const urls = [...selected];
    setProgress({ done: 0, total: urls.length });
    for (let i = 0; i < urls.length; i++) {
      try {
        await fetch('/api/photos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i], toDate: target }),
        });
      } catch { /* keep going; reload reflects reality */ }
      setProgress({ done: i + 1, total: urls.length });
    }
    setBusy(false);
    await load(source);
    onChanged?.();
  }

  if (!configured) return null;
  const sameTarget = target === source;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-sm text-muted">From session</span>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
        >
          {dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
      </div>

      {photos === null ? (
        <p className="text-xs text-muted">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted">No movable (uploaded) photos on this date.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">{selected.size} of {photos.length} selected</span>
            <button onClick={toggleAll} className="text-xs font-medium text-foreground hover:underline underline-offset-2">
              {allSelected ? 'Clear' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {photos.map((p) => {
              const on = selected.has(p.url);
              return (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => toggle(p.url)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${on ? 'border-foreground' : 'border-transparent'}`}
                  aria-pressed={on}
                >
                  <img src={p.url} alt="" className={`w-full h-full object-cover transition-opacity ${on ? 'opacity-100' : 'opacity-70'}`} />
                  {on && (
                    <span className="absolute top-1 right-1 grid place-items-center w-4 h-4 rounded-full bg-foreground text-background">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">To session</span>
              <button
                type="button"
                onClick={() => { if (targetNew) { setTargetNew(false); setTarget(dates.find((d) => d !== source) || dates[0]); } else { setTargetNew(true); setTarget(nextSessionDate(dates)); } }}
                className="text-xs font-medium text-foreground hover:underline underline-offset-2"
              >
                {targetNew ? 'Pick existing' : '+ New session date'}
              </button>
            </div>
            {targetNew ? (
              <input
                type="date"
                value={target}
                max={todayIso()}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
              />
            ) : (
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
                {dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
                {!dates.includes(target) && <option value={target}>{fmtDate(target)}</option>}
              </select>
            )}
            {sameTarget && <p className="text-[11px] text-warn">Pick a different session to move into.</p>}
          </div>

          <button
            onClick={doMove}
            disabled={!selected.size || sameTarget || busy}
            className="w-full rounded-full bg-foreground text-background py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <ArrowRight size={14} strokeWidth={2.2} />
            {busy ? `Moving ${progress.done}/${progress.total}…` : `Move ${selected.size || ''} to ${target ? fmtDate(target) : '…'}`}
          </button>
        </>
      )}
    </div>
  );
}
