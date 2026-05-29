import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, ChevronUp, ChevronDown, Plus } from 'lucide-react';

const NAME_KEY = 'aiworkshop_voter_name';
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
  const [name, setName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) || '' : ''));
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

  function setName_(v) { setName(v); localStorage.setItem(NAME_KEY, v); }

  async function submit() {
    if (!name.trim() || text.trim().length < 3 || busy) return;
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
    if (!name.trim()) return;
    const r = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', id, dir, name: name.trim() }),
    });
    const j = await r.json();
    if (j.ok) setList((items) => items.map((s) => (s.id === id ? j.suggestion : s)).sort((a, b) => b.score - a.score));
    else if (j.configured === false) setConfigured(false);
  }

  return (
    <section className="h-full rounded-2xl border border-border bg-pill p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
        <Lightbulb size={12} strokeWidth={2} />
        <span>Suggestions</span>
      </div>
      <p className="mt-2 text-xs text-muted">Suggest what to build next. Enter your name once, then you can suggest and upvote/downvote (one vote each).</p>

      {!configured && (
        <div className="mt-3 text-xs text-warn">Not connected to a store yet. Add Upstash Redis and redeploy (same store as Polls).</div>
      )}

      {configured && !name.trim() && (
        <div className="mt-3 text-xs text-warn">Enter your name below to vote or suggest.</div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-background p-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName_(e.target.value)}
          placeholder="Your name (required to vote or suggest)"
          maxLength={48}
          className={`w-full bg-background border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-foreground ${name.trim() ? 'border-border' : 'border-warn/60'}`}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What should we build or do next?"
          rows={2}
          maxLength={280}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:border-foreground"
        />
        <button
          onClick={submit}
          disabled={!name.trim() || text.trim().length < 3 || busy}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01]"
        >
          <Plus size={13} strokeWidth={2.5} /> Suggest
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {list === null && <li className="text-xs text-muted">Loading…</li>}
        {list?.length === 0 && <li className="text-xs text-muted">No suggestions yet. Be the first.</li>}
        {list?.map((s) => {
          const mine = myVote(s, name);
          return (
            <li key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => vote(s.id, 'up')}
                  disabled={!name.trim()}
                  className={`p-0.5 transition-colors disabled:opacity-40 ${mine === 'up' ? 'text-ok' : 'text-muted hover:text-foreground'}`}
                  aria-label="Upvote"
                ><ChevronUp size={18} strokeWidth={2.4} /></button>
                <span className="text-sm font-semibold num">{s.score}</span>
                <button
                  onClick={() => vote(s.id, 'down')}
                  disabled={!name.trim()}
                  className={`p-0.5 transition-colors disabled:opacity-40 ${mine === 'down' ? 'text-err' : 'text-muted hover:text-foreground'}`}
                  aria-label="Downvote"
                ><ChevronDown size={18} strokeWidth={2.4} /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{s.text}</p>
                <p className="text-[11px] text-muted mt-1">by {s.createdBy}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
