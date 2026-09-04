import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Hammer, PackageCheck, Link2, Pencil, Plus, Trash2, X, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { useIsOrganizer } from '../lib/members.js';
import { getInitials } from '../lib/members-profile.js';

// What members are building, in their own words. One card each, three lines:
// building, shipped, link. This is the community's purpose made visible between
// Sundays, and the only part of the Members page members write themselves.

const MAX_TEXT = 160;

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export default function ProjectsBoard() {
  const { user } = useAuth();
  const organizer = useIsOrganizer();
  const [projects, setProjects] = useState(null); // null = loading
  const [configured, setConfigured] = useState(true);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await authedFetch('/api/projects');
      const j = await r.json();
      setProjects(j.projects || []);
      setConfigured(j.configured !== false);
    } catch {
      setProjects([]);
    }
  }, []);
  useEffect(() => { load(); }, [load, user]);

  async function act(body) {
    setErr('');
    const r = await authedFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { setErr(j.error || 'Could not save.'); return false; }
    setProjects(j.projects || []);
    return true;
  }

  const mine = (projects || []).find((p) => p.mine) || null;
  const list = projects || [];

  return (
    <section aria-labelledby="projects-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="projects-title" className="flex items-center gap-1.5 h-section">
            <Hammer size={11} strokeWidth={2.2} /><span>What we are building</span>
            {list.length > 0 && <span className="pill pill-mute ml-1">{list.length}</span>}
          </h2>
          <p className="mt-1.5 text-sm text-muted">One card each: what you are building, the last thing you shipped, one link.</p>
        </div>
        {user && configured && (
          <button onClick={() => setEditing(true)} className="btn btn-sm btn-primary">
            {mine ? <><Pencil size={14} strokeWidth={2.2} /> Edit my card</> : <><Plus size={14} strokeWidth={2.4} /> Add my card</>}
          </button>
        )}
      </div>

      {err && <div className="mt-3 text-xs text-err">{err}</div>}

      {projects === null ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-pad h-28 animate-pulse" />)}
        </div>
      ) : !configured ? (
        <div className="mt-4 card card-pad text-sm text-muted">The projects board is not configured on this deployment.</div>
      ) : list.length === 0 ? (
        <div className="mt-4 card card-pad text-sm text-muted">
          Nobody has added a card yet. {user ? 'Yours can be the first.' : 'Sign in to add yours.'}
        </div>
      ) : (
        /* The whole card opens the link (Auri, 2026-09-02): a stretched anchor
           covers the card, the Remove button sits above it with its own z-index,
           so no button ever nests inside a link. Cards without a link stay plain. */
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((p) => (
            <li key={p.id} className={`card card-pad relative flex flex-col gap-3 ${p.link ? 'transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-foreground/30' : ''} ${p.mine ? 'ring-1 ring-[var(--gold-edge)]' : ''}`}>
              {p.link && (
                <a
                  href={p.link}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 rounded-[inherit] z-0"
                  aria-label={`${p.name}: ${p.building || p.shipped}, open ${hostOf(p.link)} in a new tab`}
                />
              )}
              <div className="flex items-center gap-2.5 min-w-0">
                {p.avatar
                  ? <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-accent flex-shrink-0" />
                  : <span className="w-8 h-8 rounded-full grid place-items-center bg-accent text-[11px] font-semibold flex-shrink-0">{getInitials(p.name)}</span>}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  {p.mine && <div className="text-[11px] text-muted">Your card</div>}
                </div>
                {(p.mine || organizer) && (
                  <button
                    onClick={() => { if (confirm(`Remove ${p.mine ? 'your' : `${p.name}'s`} card?`)) act({ action: 'delete', id: p.id }); }}
                    className="relative z-10 ml-auto grid place-items-center w-7 h-7 rounded-md text-muted hover:text-err hover:bg-accent transition-colors"
                    aria-label={`Remove ${p.name}'s card`}
                  ><Trash2 size={13} /></button>
                )}
              </div>
              {p.building && (
                <div className="flex items-start gap-2 text-sm">
                  <Hammer size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-muted" aria-hidden />
                  <div><span className="sr-only">Building: </span>{p.building}</div>
                </div>
              )}
              {p.shipped && (
                <div className="flex items-start gap-2 text-sm text-muted">
                  <PackageCheck size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0" aria-hidden />
                  <div><span className="sr-only">Shipped: </span>{p.shipped}</div>
                </div>
              )}
              {p.link && (
                <div className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted" aria-hidden>
                  <Link2 size={13} strokeWidth={2.2} /> {hostOf(p.link)}
                  <ExternalLink size={11} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && <CardEditor initial={mine} onSave={async (fields) => { const ok = await act({ action: 'save', ...fields }); if (ok) setEditing(false); return ok; }} onClose={() => setEditing(false)} />}
    </section>
  );
}

function CardEditor({ initial, onSave, onClose }) {
  const [building, setBuilding] = useState(initial?.building || '');
  const [shipped, setShipped] = useState(initial?.shipped || '');
  const [link, setLink] = useState(initial?.link || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await onSave({ building: building.trim(), shipped: shipped.trim(), link: link.trim() });
    setBusy(false);
  }

  const canSave = Boolean(building.trim() || shipped.trim());

  return createPortal(
    <div className="modal-overlay z-[100]" onClick={onClose}>
      <form className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold tracking-tight">{initial ? 'Edit my card' : 'Add my card'}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted mb-4">Short and concrete. Members see this; the rest of the internet does not.</p>

        <label className="block">
          <span className="text-[11px] font-medium text-muted">What I am building</span>
          <input value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={MAX_TEXT} placeholder="A Chrome extension that drafts replies to community email" className="input mt-1" autoFocus />
        </label>
        <label className="block mt-3">
          <span className="text-[11px] font-medium text-muted">Last thing I shipped</span>
          <input value={shipped} onChange={(e) => setShipped(e.target.value)} maxLength={MAX_TEXT} placeholder="v0.1 to three friends, first real replies sent" className="input mt-1" />
        </label>
        <label className="block mt-3">
          <span className="text-[11px] font-medium text-muted">One link</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} type="url" inputMode="url" placeholder="https://" className="input mt-1" />
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={busy || !canSave} className="btn btn-primary">
            {busy && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
