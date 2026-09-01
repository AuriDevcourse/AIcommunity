import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { authedFetch } from '../lib/supabase.js';
import { compressImage, formatBytes } from '../lib/compressImage.js';

const MAX_BYTES = 3 * 1024 * 1024;

// Drop an image or GIF, get a hosted URL (via the same ImgBB proxy the forum uses).
// Images are auto-compressed first so the hosted file stays light.
export default function ImageToLink() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saved, setSaved] = useState(null); // { before, after }
  const fileRef = useRef(null);

  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) { setErr('Pick an image or GIF.'); return; }
    setErr(''); setBusy(true); setUrl(''); setSaved(null);
    try {
      const { data: image, bytes, originalBytes, skipped } = await compressImage(file);
      if (bytes > MAX_BYTES) { setErr('Image too large (max 3MB even after compression).'); setBusy(false); return; }
      if (!skipped) setSaved({ before: originalBytes, after: bytes });
      const r = await authedFetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, name: file.name }),
      });
      const j = await r.json();
      if (j.ok) setUrl(j.url);
      else setErr(j.error || 'Upload failed.');
    } catch (e) {
      setErr(e.message || 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-1.5 h-section">
        <ImagePlus size={11} strokeWidth={2.2} />
        <span>Image to link</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Image to link</h1>
      <p className="text-sm text-muted mt-1 max-w-2xl">Drop an image or GIF and get a shareable URL. Images are compressed automatically so the link stays light. Handy for issues, posts, and demos.</p>

      <div
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) upload(e.dataTransfer.files[0]); }}
        className={`mt-5 rounded-xl border border-dashed py-12 text-center text-sm transition-colors cursor-pointer ${
          dragOver ? 'border-foreground bg-accent text-foreground' : 'border-border bg-pill text-muted hover:border-foreground hover:text-foreground'
        }`}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Uploading…</span>
        ) : (
          <span className="inline-flex items-center gap-2"><ImagePlus size={16} /> Drop an image / GIF, or click to choose</span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

      {err && <p className="mt-2 text-xs text-err">{err}</p>}

      {saved && saved.before > saved.after && (
        <p className="mt-2 text-xs text-ok">
          Compressed {formatBytes(saved.before)} → {formatBytes(saved.after)} ({Math.round((1 - saved.after / saved.before) * 100)}% smaller)
        </p>
      )}

      {url && (
        <div className="mt-5 card card-pad">
          <img src={url} alt="" className="max-h-64 rounded-lg border border-border mx-auto" />
          <div className="mt-4 flex items-center gap-2">
            <input readOnly value={url} className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-xs num focus:outline-none" onFocus={(e) => e.target.select()} />
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-2 text-xs font-medium hover:bg-accent transition-colors">
              {copied ? <Check size={13} strokeWidth={2.5} className="text-ok" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-2 text-xs font-medium hover:bg-accent transition-colors">
              <ExternalLink size={13} /> Open
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
