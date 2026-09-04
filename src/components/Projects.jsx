import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, ArrowUpRight, UserRound, Plus, X, Trash2, Loader2, ImagePlus } from 'lucide-react';
import seed from '../../data/projects.json';
import { useAuth } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { compressImage } from '../lib/compressImage.js';

// The public Projects showcase. Seed cards ship in data/projects.json; signed-in
// members add their own through /api/showcase (stored server-side). A page behind
// a login wall is kept out with "public": false on a seed card.
const STATUS_PILL = { live: 'pill-ok', beta: 'pill-warn', wip: 'pill-mute' };
const STATUS_LABEL = { live: 'Live', beta: 'Beta', wip: 'In progress' };
const STATUS_OPTS = [['live', 'Live'], ['beta', 'Beta'], ['wip', 'In progress']];
const EMPTY = { name: '', tagline: '', desc: '', url: '', status: 'live', by: '', thumb: '', tags: ['', '', ''] };

function ProjectCard({ p, onDelete }) {
  const pill = STATUS_PILL[p.status] || 'pill-mute';
  return (
    <article className="warm-card card-interactive relative overflow-hidden flex flex-col h-full">
      {p.thumb && (
        <div className="aspect-[16/9] bg-pill border-b border-border overflow-hidden">
          <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2">
          <span className={`pill ${pill}`}>{STATUS_LABEL[p.status] || p.status || 'Live'}</span>
        </div>
        <h2 className="mt-3 text-base font-semibold tracking-tight leading-snug">{p.name}</h2>
        {p.tagline && <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>}
        {p.desc && <p className="mt-2 text-sm text-muted leading-relaxed flex-1">{p.desc}</p>}
        {p.by && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
            <UserRound size={12} strokeWidth={2} /> Built by {p.by}
          </span>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex flex-wrap gap-1.5 min-w-0">
            {(p.tags || []).map((t) => <span key={t} className="text-[11px] text-muted">#{t}</span>)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold flex-none">
            {p.cta || 'Open'} <ArrowUpRight size={13} strokeWidth={2.5} />
          </span>
        </div>
      </div>
      {/* Whole card opens the project (stretched link) */}
      <a href={p.url} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={`Open ${p.name}`} />
      {p.mine && onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id); }}
          className="absolute top-2 right-2 z-10 grid place-items-center w-8 h-8 rounded-lg bg-background/90 border border-border text-muted hover:text-err transition-colors"
          aria-label="Remove my project"
        >
          <Trash2 size={14} />
        </button>
      )}
    </article>
  );
}

export default function Projects() {
  const { user, name: authName, enabled: authEnabled } = useAuth();
  const [showcase, setShowcase] = useState(null); // null = loading
  const seedItems = (seed.projects || []).filter((p) => p.public !== false);

  const load = useCallback(async () => {
    try {
      const r = await authedFetch('/api/showcase');
      const j = await r.json().catch(() => ({}));
      setShowcase(Array.isArray(j.projects) ? j.projects : []);
    } catch { setShowcase([]); }
  }, []);
  useEffect(() => { load(); }, [load, user]);

  const items = [...seedItems, ...(showcase || [])];

  async function del(id) {
    const r = await authedFetch('/api/showcase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) setShowcase(j.projects || []);
  }

  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 h-section">
            <Rocket size={11} strokeWidth={2.2} />
            <span>Projects</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Things we build</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">Projects from the AI Sundays community, built one Sunday at a time.</p>
        </div>
        {user && authEnabled && (
          <button onClick={() => setAdding(true)} className="btn btn-sm btn-primary">
            <Plus size={14} strokeWidth={2.4} /> Add a project
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card card-pad mt-5 text-sm text-muted text-center">
          No projects yet. {user ? 'Add the first one.' : 'Sign in to add the first one.'}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => <ProjectCard key={p.id} p={p} onDelete={del} />)}
        </div>
      )}

      {!user && authEnabled && (
        <p className="mt-4 text-xs text-muted">Sign in to add your own project to the showcase.</p>
      )}

      {adding && <AddProject defaultBy={authName} onClose={() => setAdding(false)} onSaved={(list) => { setShowcase(list); setAdding(false); }} />}
    </div>
  );
}

function AddProject({ defaultBy, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, by: defaultBy || '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setTag = (i, v) => setForm((f) => { const tags = [...f.tags]; tags[i] = v; return { ...f, tags }; });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(''); setUploading(true);
    try {
      const { data: image } = await compressImage(file);
      const r = await authedFetch('/api/upload-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, name: file.name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok || !j.url) setErr(j.error || 'Could not upload that image.');
      else set('thumb', j.url);
    } catch { setErr('Could not process that image.'); }
    setUploading(false);
  }

  async function submit(e) {
    e.preventDefault();
    setErr(''); setSaving(true);
    const body = {
      action: 'add',
      name: form.name, tagline: form.tagline, desc: form.desc, url: form.url,
      status: form.status, thumb: form.thumb, by: form.by,
      tags: form.tags.map((t) => t.trim()).filter(Boolean),
    };
    const r = await authedFetch('/api/showcase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || !j.ok) { setErr(j.error || 'Could not save. Please try again.'); return; }
    onSaved(j.projects || []);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card card-pad w-full max-w-lg my-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Add a project</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-accent transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        {/* Picture */}
        <label className="block mt-4 text-xs font-medium text-muted">Picture</label>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="w-28 aspect-[16/9] rounded-lg bg-pill border border-border overflow-hidden grid place-items-center flex-none">
            {form.thumb
              ? <img src={form.thumb} alt="" className="w-full h-full object-cover" />
              : <ImagePlus size={18} className="text-muted" />}
          </div>
          <label className="btn btn-sm cursor-pointer">
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading</> : <>Choose image</>}
            <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={uploading} />
          </label>
        </div>

        {/* Live label */}
        <label className="block mt-4 text-xs font-medium text-muted">Label</label>
        <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input mt-1.5 w-full">
          {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* Headline */}
        <label className="block mt-4 text-xs font-medium text-muted">Headline</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} required placeholder="Project name" className="input mt-1.5 w-full" />

        {/* Subtitle */}
        <label className="block mt-4 text-xs font-medium text-muted">Subtitle</label>
        <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} placeholder="One line about it" className="input mt-1.5 w-full" />

        {/* Short description */}
        <label className="block mt-4 text-xs font-medium text-muted">Short description</label>
        <textarea value={form.desc} onChange={(e) => set('desc', e.target.value)} maxLength={400} rows={3} placeholder="What it does, and why it is worth a look." className="input mt-1.5 w-full resize-y" />

        {/* Link */}
        <label className="block mt-4 text-xs font-medium text-muted">Link</label>
        <input value={form.url} onChange={(e) => set('url', e.target.value)} maxLength={500} required placeholder="https://..." className="input mt-1.5 w-full" />

        {/* Tags */}
        <label className="block mt-4 text-xs font-medium text-muted">Tags (up to 3)</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <input key={i} value={form.tags[i]} onChange={(e) => setTag(i, e.target.value)} maxLength={24} placeholder={`tag ${i + 1}`} className="input w-full" />
          ))}
        </div>

        {/* Built by */}
        <label className="block mt-4 text-xs font-medium text-muted">Built by</label>
        <input value={form.by} onChange={(e) => set('by', e.target.value)} maxLength={60} placeholder="Your name" className="input mt-1.5 w-full" />

        {err && <p className="mt-4 text-sm text-err">{err}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-sm">Cancel</button>
          <button type="submit" disabled={saving || uploading} className="btn btn-sm btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : <>Add project</>}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
