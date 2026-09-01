import { useCallback, useEffect, useState } from 'react';
import { MessagesSquare, Plus, ChevronDown, Trash2, Lightbulb, Sparkles, BarChart3 } from 'lucide-react';
import { useMemberName } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { SignInGate } from './AuthControls.jsx';
import SessionThread from './SessionThread.jsx';
import Polls from './Polls.jsx';

const ci = (s) => String(s || '').trim().toLowerCase();

// The "Ideas" board is a pinned, score-sorted thread on a fixed channel, it lives
// outside the user-created topics list (can't be deleted) and is where suggestions
// for what to build next get voted on and discussed.
const IDEAS_CHANNEL = 'ideas';
const IDEAS_TITLE = 'Ideas: what should we build next?';

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Discussions() {
  const [topics, setTopics] = useState(null);
  const [configured, setConfigured] = useState(true);
  const { authMode, name, isReady: named } = useMemberName();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // expanded topic id

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/topics');
      const j = await r.json();
      setTopics(j.topics || []);
      setConfigured(j.configured !== false);
    } catch {
      setTopics([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep-link: open a specific topic when arriving from the cockpit "Latest discussion".
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('forum_open_topic');
      if (pending) { setOpen(pending); sessionStorage.removeItem('forum_open_topic'); }
    } catch { /* ignore */ }
  }, []);

  async function create() {
    if (!named || title.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: title.trim(), name: name.trim() }),
      });
      const j = await r.json();
      if (j.ok) { setTitle(''); setTopics((t) => [j.topic, ...(t || [])]); setOpen(j.topic.id); }
      else if (j.configured === false) setConfigured(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setTopics((t) => (t || []).filter((x) => x.id !== id)); // optimistic
    if (open === id) setOpen(null);
    await authedFetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, name: name.trim() }),
    });
    load();
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 h-section">
        <MessagesSquare size={11} strokeWidth={2.2} />
        <span>Discussions</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Community forum</h1>
      <p className="text-sm text-muted mt-1">Vote on the ideas and polls below, or start a topic of your own.</p>

      {!configured && (
        <div className="card card-pad mt-5 text-sm text-warn">Discussions need a store. Add Upstash Redis and redeploy (same store as Polls).</div>
      )}

      {/* Start a topic */}
      <div className="warm-card card-pad mt-5">
        {authMode && !named ? (
          <SignInGate label="Sign in to start a topic" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
              placeholder="Start a topic… e.g. Best local LLM for 16GB RAM?"
              maxLength={140}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-foreground"
            />
            <button
              onClick={create}
              disabled={title.trim().length < 3 || busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            >
              <Plus size={15} strokeWidth={2.5} /> {busy ? 'Starting…' : 'Start topic'}
            </button>
          </div>
        )}
      </div>

      {/* Topics */}
      <div className="mt-5 space-y-3">
        {/* Pinned: the Ideas board (vote + reply on what to build next). Expanded by
            default, showing the top 3 ideas with a "See more" for the rest. */}
        <div className="card top-idea-card overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <span className="ideas-chip grid place-items-center w-9 h-9 rounded-lg flex-shrink-0">
              <Lightbulb size={17} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
                <span className="truncate">{IDEAS_TITLE}</span>
                <span className="pill-top flex-shrink-0"><Sparkles size={11} strokeWidth={2.4} /> pinned</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">Suggest an idea · vote · reply · sorted by votes</div>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <SessionThread
              channel={IDEAS_CHANNEL}
              title="Ideas"
              subtitle=""
              bare
              sortBy="score"
              initialLimit={3}
              composerPlaceholder="What should we build or do next?"
              postLabel="Suggest idea"
              emptyLabel="No ideas yet. Suggest the first one."
            />
          </div>
        </div>

        {/* Pinned: Polls (structured votes from organisers). Expanded, top 3 shown. */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent text-foreground flex-shrink-0">
              <BarChart3 size={17} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">Polls</div>
              <div className="text-[11px] text-muted mt-0.5">Quick votes and gut-checks · one vote per person</div>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <Polls embedded initialLimit={3} />
          </div>
        </div>

        {topics === null && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-24 mt-2" />
          </div>
        ))}
        {topics?.length === 0 && (
          <div className="card card-pad text-sm text-muted text-center">No topics yet. Start the first conversation.</div>
        )}
        {topics?.map((t) => {
          const isOpen = open === t.id;
          const own = named && ci(t.createdBy) === ci(name);
          return (
            <div key={t.id} className={`card ${isOpen ? '' : 'card-interactive'}`}>
              <button
                onClick={() => setOpen(isOpen ? null : t.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 text-left p-4 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">{t.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">by {t.createdBy} · {timeAgo(t.createdAt)}</div>
                </div>
                <ChevronDown size={16} className={`flex-shrink-0 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border p-4">
                  <SessionThread channel={t.id} title="Replies" subtitle="" bare />
                  {own && (
                    <button onClick={() => remove(t.id)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-err transition-colors">
                      <Trash2 size={13} /> Delete topic
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
