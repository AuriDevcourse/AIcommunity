import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, ChevronUp, ChevronDown, Plus, Pencil, Check } from 'lucide-react';
import { useMemberName } from '../lib/auth.jsx';
import { SignInGate } from './AuthControls.jsx';

const MAX = 280;
const MIN = 3;
const ci = (s) => String(s || '').trim().toLowerCase();

function myVote(s, name) {
  if (!name) return null;
  const n = ci(name);
  if ((s.voters?.up || []).some((v) => ci(v) === n)) return 'up';
  if ((s.voters?.down || []).some((v) => ci(v) === n)) return 'down';
  return null;
}

export default function Suggestions() {
  const [list, setList] = useState(null);
  const [configured, setConfigured] = useState(true);
  const { authMode, name, setName, isReady: named } = useMemberName();
  const [editingName, setEditingName] = useState(!name);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/suggestions');
      const j = await r.json();
      setList(j.suggestions || []);
      setConfigured(j.configured !== false);
    } catch {
      setList([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const canSuggest = named && text.trim().length >= MIN && !busy;

  async function submit() {
    if (!canSuggest) return;
    setBusy(true);
    try {
      const r = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', text: text.trim(), name: name.trim() }),
      });
      const j = await r.json();
      if (j.ok) { setText(''); await load(); }
      else if (j.configured === false) setConfigured(false);
    } finally {
      setBusy(false);
    }
  }

  async function vote(id, dir) {
    if (!named) return;
    const r = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', id, dir, name: name.trim() }),
    });
    const j = await r.json();
    if (j.ok) setList((items) => items.map((s) => (s.id === id ? j.suggestion : s)).sort((a, b) => b.score - a.score));
    else if (j.configured === false) setConfigured(false);
  }

  // ⌘/Ctrl + Enter posts from the textarea.
  function onComposerKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  }

  return (
    <section className="h-full warm-card p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
        <Lightbulb size={12} strokeWidth={2} />
        <span>Suggestions</span>
      </div>
      <p className="mt-2 text-sm text-muted leading-relaxed">Suggest what to build next, then upvote the best ideas.</p>

      {!configured && (
        <div className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Not connected to a store yet. Add Upstash Redis and redeploy (same store as Polls).</div>
      )}

      {/* Composer */}
      <div className="mt-4 rounded-xl border border-border bg-background p-3">
        {authMode ? (
          !named && <SignInGate label="Sign in to suggest" />
        ) : (editingName || !named ? (
          <div>
            <label className="text-[11px] font-medium text-muted">Your name</label>
            <div className="mt-1 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && named) setEditingName(false); }}
                placeholder="Required to vote or suggest"
                maxLength={48}
                autoFocus={editingName && !named}
                className={`flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-foreground ${named ? 'border-border' : 'border-warn/60'}`}
              />
              {named && (
                <button
                  onClick={() => setEditingName(false)}
                  className="grid place-items-center w-11 rounded-lg bg-foreground text-background transition-transform enabled:hover:scale-[1.03]"
                  aria-label="Save name"
                >
                  <Check size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="pill pill-ok"><Check size={11} strokeWidth={2.8} />{name.trim()}</span>
              <span className="text-xs text-muted truncate">posting as you</span>
            </span>
            <button
              onClick={() => setEditingName(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
            >
              <Pencil size={12} /> Change
            </button>
          </div>
        ))}

        {(!authMode || named) && (
          <>
        <div className="relative mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder={named ? 'What should we build or do next?' : 'Add your name above first…'}
            rows={2}
            maxLength={MAX}
            disabled={!named}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 pb-6 text-sm resize-y focus:outline-none focus:border-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`pointer-events-none absolute bottom-2 right-3 text-[10px] num ${text.length > MAX - 30 ? 'text-warn' : 'text-muted'}`}>
            {text.length}/{MAX}
          </span>
        </div>

        <button
          onClick={submit}
          disabled={!canSuggest}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background text-foreground py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={2.2} /> {busy ? 'Posting…' : 'Suggest an idea'}
        </button>
          </>
        )}
      </div>

      {/* List */}
      <ul className="mt-4 space-y-2">
        {list === null && Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
            <div className="skeleton w-9 h-12 flex-shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3 w-20" />
            </div>
          </li>
        ))}
        {list?.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-5 text-center">
            <Lightbulb size={18} strokeWidth={2} className="mx-auto text-muted" />
            <p className="mt-2 text-xs text-muted">No suggestions yet. Be the first to add one.</p>
          </li>
        )}
        {list?.map((s, idx) => {
          const mine = myVote(s, name);
          const own = named && ci(s.createdBy) === ci(name);
          const top = idx === 0 && s.score > 0;
          return (
            <li
              key={s.id}
              className={`flex items-start gap-3 rounded-xl border bg-background p-3 transition-colors ${own ? 'border-foreground/40' : 'border-border'}`}
            >
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => vote(s.id, 'up')}
                  disabled={!named}
                  className={`grid place-items-center w-9 h-9 rounded-lg transition-colors disabled:opacity-40 ${mine === 'up' ? 'text-ok bg-ok/10' : 'text-muted hover:text-foreground hover:bg-accent'}`}
                  aria-label="Upvote"
                  aria-pressed={mine === 'up'}
                ><ChevronUp size={20} strokeWidth={2.4} /></button>
                <span className="text-sm font-semibold num tabular-nums">{s.score}</span>
                <button
                  onClick={() => vote(s.id, 'down')}
                  disabled={!named}
                  className={`grid place-items-center w-9 h-9 rounded-lg transition-colors disabled:opacity-40 ${mine === 'down' ? 'text-err bg-err/10' : 'text-muted hover:text-foreground hover:bg-accent'}`}
                  aria-label="Downvote"
                  aria-pressed={mine === 'down'}
                ><ChevronDown size={20} strokeWidth={2.4} /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{s.text}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>by {s.createdBy}</span>
                  {own && <span className="pill pill-mute">you</span>}
                  {top && <span className="pill pill-ok">top idea</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
