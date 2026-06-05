import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Plus, X, Check, RefreshCw, Users } from 'lucide-react';
import { useMemberName } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { SignInGate } from './AuthControls.jsx';
const ci = (s) => String(s || '').trim().toLowerCase();

// Which option ids the current name has already voted for, read from server state.
function myVote(poll, name) {
  if (!name) return [];
  const n = ci(name);
  return poll.options.filter((o) => (poll.voters[o.id] || []).some((v) => ci(v) === n)).map((o) => o.id);
}
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function Polls({ embedded = false }) {
  const [polls, setPolls] = useState(null);
  const { authMode, name, setName } = useMemberName();
  const [drafts, setDrafts] = useState({}); // pollId -> optionId[] (in-progress, unsaved)
  const [busy, setBusy] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState('');

  const [configured, setConfigured] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/polls');
      const j = await r.json();
      setPolls(j.polls || []);
      setConfigured(j.configured !== false);
    } catch {
      setPolls([]);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Selected = unsaved draft if the user touched it, else their saved server vote.
  const selectedFor = (poll) => drafts[poll.id] ?? myVote(poll, name);

  function toggle(poll, optionId) {
    const cur = selectedFor(poll);
    let next;
    if (poll.multi) {
      next = cur.includes(optionId) ? cur.filter((o) => o !== optionId) : [...cur, optionId];
    } else {
      next = cur.includes(optionId) ? [] : [optionId];
    }
    setDrafts((d) => ({ ...d, [poll.id]: next }));
  }

  async function submitVote(poll) {
    if (!name.trim()) return;
    const optionIds = selectedFor(poll);
    if (optionIds.length === 0) return;
    setBusy(poll.id);
    try {
      const r = await authedFetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId: poll.id, name: name.trim(), optionIds }),
      });
      const j = await r.json();
      if (j.ok) {
        setErr('');
        setDrafts((d) => { const n = { ...d }; delete n[poll.id]; return n; });
        setPolls((ps) => ps.map((p) => (p.id === poll.id ? j.poll : p)));
      } else {
        setErr(j.error || 'Could not save your vote.');
      }
    } catch {
      setErr('Voting is unavailable. The poll backend may not be configured yet.');
    } finally {
      setBusy(null);
    }
  }

  async function act(body) {
    setBusy(body.pollId || 'create');
    try {
      const r = await authedFetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Action failed.'); else setErr('');
      await load();
    } catch {
      setErr('The poll backend is unreachable. It may not be configured yet.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={embedded ? '' : 'max-w-3xl mx-auto'}>
      {!embedded && (
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-1.5 h-section">
              <BarChart3 size={11} strokeWidth={2.2} />
              <span>Polls</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mt-1">Vote &amp; gut-checks</h2>
            <p className="text-sm text-muted mt-1">Enter your name once, then vote. One vote per name, change it anytime.</p>
          </div>
          <button
            onClick={() => load()}
            className="text-muted hover:text-foreground transition-colors p-2"
            title="Refresh"
            aria-label="Refresh polls"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {authMode ? (
        !name.trim() && (
          <div className="card card-pad mb-5">
            <SignInGate label="Sign in to vote and create polls" />
          </div>
        )
      ) : (
        <div className="card card-pad mb-5 flex items-center gap-3">
          <Users size={16} strokeWidth={2} className="text-muted flex-shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (required to vote)"
            maxLength={48}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
          />
          {name.trim() && <span className="pill pill-ok flex-shrink-0"><Check size={11} strokeWidth={2.5} />{name.trim()}</span>}
        </div>
      )}

      {!configured && (
        <div className="card card-pad mb-5 text-sm text-warn" role="alert">
          Polls have no store yet. Add an Upstash Redis database and redeploy (see docs/polls-setup.md). Voting stays off until then.
        </div>
      )}

      {err && (
        <div className="card card-pad mb-5 text-sm text-err border-err/30" role="alert">{err}</div>
      )}

      {polls === null && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card card-pad space-y-3">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {polls?.length === 0 && (
        <div className="card card-pad text-sm text-muted">No polls yet. Create the first one below.</div>
      )}

      <div className="space-y-4">
        {polls?.map((poll) => {
          const selected = selectedFor(poll);
          const saved = myVote(poll, name);
          const dirty = !sameSet(selected, saved);
          const maxCount = Math.max(1, ...poll.options.map((o) => poll.results[o.id] || 0));
          return (
            <div key={poll.id} className={`card card-pad ${poll.closed ? 'opacity-80' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold tracking-tight break-words">{poll.question}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-muted">
                    <span className="pill pill-mute">{poll.multi ? 'Pick any' : 'Pick one'}</span>
                    <span className="text-xs num">{poll.totalVoters} {poll.totalVoters === 1 ? 'voter' : 'voters'}</span>
                    {poll.closed && <span className="pill pill-warn">closed</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {poll.options.map((opt) => {
                  const count = poll.results[opt.id] || 0;
                  const isSel = selected.includes(opt.id);
                  const voters = poll.voters[opt.id] || [];
                  const barPct = (count / maxCount) * 100;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !poll.closed && toggle(poll, opt.id)}
                      disabled={poll.closed}
                      className={`relative w-full overflow-hidden text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        isSel ? 'border-foreground bg-pill' : 'border-border bg-background hover:border-foreground/40'
                      } ${poll.closed ? 'cursor-default' : ''}`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500"
                        style={{ width: `${barPct}%` }}
                        aria-hidden
                      />
                      <span className="relative flex items-center gap-2.5">
                        <span
                          className={`flex-shrink-0 grid place-items-center w-4 h-4 border ${
                            poll.multi ? 'rounded' : 'rounded-full'
                          } ${isSel ? 'bg-foreground border-foreground text-background' : 'border-muted'}`}
                        >
                          {isSel && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-sm font-medium">{opt.label}</span>
                        <span className="text-sm num text-muted">{count}</span>
                      </span>
                      {voters.length > 0 && (
                        <span className="relative mt-1.5 flex flex-wrap gap-1 pl-[26px]">
                          {voters.slice(0, 8).map((v, i) => (
                            <span key={i} className="text-[10px] text-muted bg-background/70 rounded px-1.5 py-0.5 border border-border">{v}</span>
                          ))}
                          {voters.length > 8 && (
                            <span className="text-[10px] text-muted px-1.5 py-0.5">+{voters.length - 8} more</span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!poll.closed && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => submitVote(poll)}
                    disabled={!name.trim() || selected.length === 0 || !dirty || busy === poll.id}
                    className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
                  >
                    {busy === poll.id ? 'Saving…' : saved.length ? 'Update vote' : 'Vote'}
                  </button>
                  {!name.trim() && <span className="text-xs text-warn">Enter your name above to vote</span>}
                  {name.trim() && saved.length > 0 && !dirty && <span className="text-xs text-muted">Your vote is in. Change a selection to update.</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Creating a poll needs an identity (logged in, or a typed name in no-auth mode). */}
      {name.trim() && (
        <CreatePoll
          open={showCreate}
          setOpen={setShowCreate}
          busy={busy === 'create'}
          creatorName={name}
          onCreate={async (payload) => { await act({ action: 'create', ...payload }); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function CreatePoll({ open, setOpen, onCreate, busy, creatorName }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => { if (open && firstRef.current) firstRef.current.focus(); }, [open]);

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  function reset() { setQuestion(''); setOptions(['', '']); setMulti(false); }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-pill px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground hover:text-background transition-colors"
      >
        <Plus size={14} strokeWidth={2.5} />
        New poll
      </button>
    );
  }

  return (
    <div className="card card-pad mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-section">New poll</div>
        <button onClick={() => { setOpen(false); reset(); }} className="text-muted hover:text-foreground" aria-label="Cancel"><X size={18} /></button>
      </div>

      <input
        ref={firstRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question, e.g. Which topic should we do next?"
        maxLength={200}
        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
      />

      <div className="mt-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={`Option ${i + 1}`}
              maxLength={100}
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
            />
            {options.length > 2 && (
              <button onClick={() => setOptions((o) => o.filter((_, j) => j !== i))} className="text-muted hover:text-err p-1" aria-label="Remove option"><X size={16} /></button>
            )}
          </div>
        ))}
      </div>

      {options.length < 12 && (
        <button onClick={() => setOptions((o) => [...o, ''])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors">
          <Plus size={13} strokeWidth={2.5} /> Add option
        </button>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setMulti((m) => !m)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${multi ? 'bg-foreground text-background border-foreground' : 'bg-pill text-foreground border-border'}`}
        >
          {multi ? 'Pick any (multi-select)' : 'Pick one'}
        </button>
        <button
          onClick={() => { onCreate({ question: question.trim(), options: options.map((o) => o.trim()).filter(Boolean), multi, createdBy: creatorName }); reset(); }}
          disabled={!valid || busy}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
        >
          {busy ? 'Creating…' : 'Create poll'}
        </button>
      </div>
    </div>
  );
}
