import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { X, Upload, Trash2, Check, ImagePlus } from 'lucide-react';

const NAME_KEY = 'aiworkshop_voter_name';
const slug = (s) => String(s || 'guest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'guest';
const safeFile = (s) => String(s).replace(/[^a-zA-Z0-9.]+/g, '-').slice(-40);
const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PhotoUploader({ dates, onClose, onChanged }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [date, setDate] = useState(dates[0] || new Date().toISOString().slice(0, 10));
  const [queue, setQueue] = useState([]); // {file, status}
  const [existing, setExisting] = useState([]);
  const [configured, setConfigured] = useState(true);
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

  function pick(e) {
    const files = [...e.target.files];
    setQueue(files.map((file) => ({ file, status: 'pending' })));
  }

  async function doUpload() {
    if (!name.trim() || queue.length === 0) return;
    localStorage.setItem(NAME_KEY, name.trim());
    for (let i = 0; i < queue.length; i++) {
      setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'uploading' } : x)));
      try {
        const f = queue[i].file;
        const pathname = `sessions/${date}/${slug(name)}__${safeFile(f.name)}`;
        await upload(pathname, f, { access: 'public', handleUploadUrl: '/api/photos', contentType: f.type || undefined });
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: 'done' } : x)));
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

          <button
            onClick={() => fileRef.current?.click()}
            disabled={!configured}
            className="w-full rounded-lg border border-dashed border-border bg-pill py-6 text-sm text-muted hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {queue.length ? `${queue.length} selected` : 'Choose photos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />

          {queue.length > 0 && (
            <ul className="space-y-1 text-xs">
              {queue.map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-muted">
                  <span className="truncate">{q.file.name}</span>
                  <span className={q.status === 'done' ? 'text-ok' : q.status === 'error' ? 'text-err' : ''}>{q.status}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={doUpload}
            disabled={!configured || !name.trim() || queue.length === 0}
            className="w-full rounded-full bg-foreground text-background py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <Upload size={14} strokeWidth={2.2} />
            {done === queue.length && queue.length ? 'Uploaded' : `Upload${queue.length ? ` ${queue.length}` : ''}`}
          </button>
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
