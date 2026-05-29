import { useEffect, useRef, useState } from 'react';
import { X, Upload, Trash2, Check, ImagePlus } from 'lucide-react';

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

export default function PhotoUploader({ dates, onClose, onChanged }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [date, setDate] = useState(dates[0] || new Date().toISOString().slice(0, 10));
  const [queue, setQueue] = useState([]); // {file, status, pct}
  const [existing, setExisting] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  async function loadExisting(d) {
    try {
      const r = await fetch('/api/photos');
      const j = await r.json();
      setConfigured(j.configured !== false);
      setExisting((j.byDate && j.byDate[d]) || []);
    } catch {
      setExisting([]);
    }
  }
  useEffect(() => { loadExisting(date); }, [date]);

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
        await uploadViaXHR({
          date,
          name: name.trim(),
          file: queue[i].file,
          onProgress: (pct) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, pct } : x))),
        });
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'done', pct: 100 } : x)));
      } catch (err) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'error', err: err.message } : x)));
      }
    }
    await loadExisting(date);
    onChanged?.();
  }

  async function remove(url) {
    if (!confirm('Remove this photo?')) return;
    await fetch(`/api/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    await loadExisting(date);
    onChanged?.();
  }

  const done = queue.filter((q) => q.status === 'done').length;
  const uploading = queue.some((q) => q.status === 'uploading');
  const overall = queue.length ? Math.round(queue.reduce((s, q) => s + (q.status === 'done' ? 100 : q.pct || 0), 0) / queue.length) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 h-section"><ImagePlus size={12} strokeWidth={2.2} /><span>Add photos</span></div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        {!configured && (
          <div className="text-sm text-warn mb-4">Uploads aren't connected yet. Add a Vercel Blob store (see docs/photos-setup.md).</div>
        )}

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (tagged on each photo)"
            maxLength={48}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Session</span>
            <select value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground">
              {dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
              {!dates.includes(date) && <option value={date}>{fmtDate(date)}</option>}
            </select>
          </label>

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
        </div>

        {existing.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="h-section mb-2">On {fmtDate(date)} · {existing.length}</div>
            <div className="grid grid-cols-4 gap-2">
              {existing.map((p) => (
                <div key={p.url} className="relative group aspect-square">
                  <img src={p.url} alt="" className="w-full h-full object-cover rounded-md border border-border" />
                  <button
                    onClick={() => remove(p.url)}
                    className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-1 text-muted hover:text-err opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <Trash2 size={11} />
                  </button>
                  {p.uploader && <span className="absolute bottom-0 inset-x-0 bg-foreground/60 text-background text-[8px] px-1 py-0.5 rounded-b-md truncate">{p.uploader}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
