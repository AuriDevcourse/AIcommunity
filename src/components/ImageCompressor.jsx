import { useRef, useState } from 'react';
import { Minimize2, Loader2, Download } from 'lucide-react';
import { compressImage, formatBytes } from '../lib/compressImage.js';

// Drop an image, get a lighter JPEG to download. Same compression the app applies
// automatically on every upload — this just exposes it as a standalone tool.
export default function ImageCompressor() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { dataUrl, before, after, name }
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  async function run(file) {
    if (!file || !file.type.startsWith('image/')) { setErr('Pick an image (JPG or PNG).'); return; }
    if (file.type === 'image/gif') { setErr('GIFs are left as-is to keep them animated.'); return; }
    setErr(''); setBusy(true); setResult(null);
    try {
      const { dataUrl, bytes, originalBytes } = await compressImage(file);
      const base = file.name.replace(/\.[^.]+$/, '');
      setResult({ dataUrl, before: originalBytes, after: bytes, name: `${base}-compressed.jpg` });
    } catch (e) {
      setErr(e.message || 'Could not compress that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const pct = result ? Math.round((1 - result.after / result.before) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-1.5 h-section">
        <Minimize2 size={11} strokeWidth={2.2} />
        <span>Image compressor</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight mt-1">Image compressor</h2>
      <p className="text-sm text-muted mt-1 max-w-2xl">Drop an image and download a lighter version. Resized to 1600px and saved as JPEG, the same compression every upload in the app uses.</p>

      <div
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) run(e.dataTransfer.files[0]); }}
        className={`mt-5 rounded-xl border border-dashed py-12 text-center text-sm transition-colors cursor-pointer ${
          dragOver ? 'border-foreground bg-accent text-foreground' : 'border-border bg-pill text-muted hover:border-foreground hover:text-foreground'
        }`}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Compressing…</span>
        ) : (
          <span className="inline-flex items-center gap-2"><Minimize2 size={16} /> Drop an image, or click to choose</span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />

      {err && <p className="mt-2 text-xs text-err">{err}</p>}

      {result && (
        <div className="mt-5 card card-pad">
          <img src={result.dataUrl} alt="" className="max-h-64 rounded-lg border border-border mx-auto" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted">{formatBytes(result.before)}</span>
              <span className="text-muted px-1.5">to</span>
              <span className="font-semibold text-foreground">{formatBytes(result.after)}</span>
              {pct > 0 && <span className="ml-2 pill pill-ok">{pct}% smaller</span>}
            </div>
            <a
              href={result.dataUrl}
              download={result.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02]"
            >
              <Download size={14} strokeWidth={2.2} /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
