import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Plus, X, Check, RefreshCw, Users, ArrowDownWideNarrow, Link2 } from 'lucide-react';
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

// Normalise an option label the way the server does, so the modal can warn about
// a duplicate before the request instead of after the rejection.
const optKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// A poll's shareable address. Mirrors #recap/<date>: a real hash route, unlike the
// forum's sessionStorage hand-off, which only ever worked inside one tab.
const pollUrl = (id) => `${window.location.origin}/#poll/${id}`;

// Apply a vote to a poll locally, so the bars move on click instead of after the
// round trip. Mirrors withResults() on the server: counts, voters and totalVoters
// all have to move together or the optimistic view disagrees with itself.
function applyVoteLocally(poll, name, optionIds) {
  const n = ci(name);
  const results = {};
  const voters = {};
  for (const opt of poll.options) {
    const was = (poll.voters[opt.id] || []).filter((v) => ci(v) !== n);
    const now = optionIds.includes(opt.id) ? [...was, name] : was;
    voters[opt.id] = now;
    results[opt.id] = now.length;
  }
  const votedBefore = poll.options.some((o) => (poll.voters[o.id] || []).some((v) => ci(v) === n));
  const votesNow = optionIds.length > 0;
  let totalVoters = poll.totalVoters || 0;
  if (!votedBefore && votesNow) totalVoters += 1;
  if (votedBefore && !votesNow) totalVoters -= 1;
  return { ...poll, results, voters, totalVoters };
}

export default function Polls({ embedded = false, initialLimit = 0 }) {
  const [polls, setPolls] = useState(null);
  const { authMode, name, setName } = useMemberName();
  const [drafts, setDrafts] = useState({}); // pollId -> optionId[] (in-progress, unsaved)
  const [busy, setBusy] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false); // with initialLimit, show first N then reveal the rest
  const [sortBy, setSortBy] = useState('order'); // 'order' | 'votes'
  const [announce, setAnnounce] = useState(''); // polite live region after a vote
  const [copiedId, setCopiedId] = useState(null);
  const [focusedOpt, setFocusedOpt] = useState({}); // pollId -> option id holding the roving tabindex

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

  // #poll/<id> scrolls to and highlights a shared poll.
  //
  // Two things this has to get right. It must fire when the LIST arrives, since a
  // cold load has no polls yet; and it must fire on a HASH CHANGE, because moving
  // from #discussions to #poll/<id> never remounts this component, so depending on
  // [polls] alone meant a visitor already on the Forum saw nothing.
  //
  // And it must fire only ONCE per link. load() refetches every 5s, so without the
  // handled ref the poll would flash again every five seconds for as long as the
  // hash stayed put.
  const [highlightId, setHighlightId] = useState(null);
  const handledHash = useRef(null);
  useEffect(() => {
    const run = () => {
      if (!polls?.length) return;
      const hash = window.location.hash.slice(1);
      const m = hash.match(/^poll\/(.+)$/);
      if (!m) { handledHash.current = null; return; }
      if (handledHash.current === hash) return;
      const id = decodeURIComponent(m[1]);
      if (!polls.some((p) => p.id === id)) return;
      handledHash.current = hash;
      setHighlightId(id);
      const el = document.getElementById(`poll-${id}`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 2400);
    };
    run();
    window.addEventListener('hashchange', run);
    return () => window.removeEventListener('hashchange', run);
  }, [polls]);

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

    // Optimistic: move the bars now, keep the previous poll so a failure can put
    // it back. The 5s poll in load() would otherwise be the first sign anything
    // happened, which reads as a dead button.
    const before = poll;
    setPolls((ps) => ps.map((p) => (p.id === poll.id ? applyVoteLocally(p, name.trim(), optionIds) : p)));
    setDrafts((d) => { const n = { ...d }; delete n[poll.id]; return n; });

    try {
      const r = await authedFetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId: poll.id, name: name.trim(), optionIds }),
      });
      const j = await r.json();
      if (j.ok) {
        setErr('');
        setPolls((ps) => ps.map((p) => (p.id === poll.id ? j.poll : p)));
        const chosen = poll.options.filter((o) => optionIds.includes(o.id)).map((o) => o.label);
        setAnnounce(`Vote saved: ${chosen.join(', ')}. ${j.poll.totalVoters} ${j.poll.totalVoters === 1 ? 'voter' : 'voters'} so far.`);
      } else {
        setPolls((ps) => ps.map((p) => (p.id === poll.id ? before : p)));      // rollback
        setDrafts((d) => ({ ...d, [poll.id]: optionIds }));                    // keep their selection
        setErr(j.error || 'Could not save your vote.');
        setAnnounce('Your vote could not be saved.');
      }
    } catch {
      setPolls((ps) => ps.map((p) => (p.id === poll.id ? before : p)));
      setDrafts((d) => ({ ...d, [poll.id]: optionIds }));
      setErr('Voting is unavailable. The poll backend may not be configured yet.');
      setAnnounce('Your vote could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  async function copyPollLink(poll) {
    try {
      await navigator.clipboard.writeText(pollUrl(poll.id));
      setCopiedId(poll.id);
      setTimeout(() => setCopiedId((c) => (c === poll.id ? null : c)), 1600);
    } catch {
      setErr('Could not copy the link. Your browser blocked clipboard access.');
    }
  }

  // Arrow keys move between options and select as they go, which is what a radio
  // group does. Home and End jump to the ends. Space and Enter are already handled
  // by the button element.
  function onOptionKeyDown(e, poll, index) {
    if (poll.closed) return;
    const n = poll.options.length;
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % n;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    const opt = poll.options[next];
    setFocusedOpt((f) => ({ ...f, [poll.id]: opt.id }));
    // Single-choice groups move the selection with the focus, the way native
    // radios do. Multi-select only moves focus; the user picks with space.
    if (!poll.multi) setDrafts((d) => ({ ...d, [poll.id]: [opt.id] }));
    const el = document.getElementById(`opt-${poll.id}-${opt.id}`);
    if (el) el.focus();
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
            <p className="text-sm text-muted mt-1">Enter your name once, then vote. One vote each, change it anytime.</p>
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
          <Users size={16} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden="true" />
          {/* A placeholder is not a label: it disappears on focus and screen
              readers treat it as a hint, so the field had no accessible name. */}
          <label htmlFor="poll-voter-name" className="sr-only">Your name, required to vote</label>
          <input
            id="poll-voter-name"
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

      {/* Voting changed numbers on screen and said nothing to a screen reader.
          Polite, so it waits for a pause rather than interrupting. */}
      <div aria-live="polite" className="sr-only">{announce}</div>

      {(polls?.length || 0) > 1 && (
        <div className="mb-3 flex items-center justify-end gap-2 text-xs">
          <ArrowDownWideNarrow size={13} className="text-muted" aria-hidden="true" />
          <span id="poll-sort-label" className="text-muted">Sort</span>
          <div role="group" aria-labelledby="poll-sort-label" className="inline-flex rounded-full border border-border overflow-hidden">
            {[['order', 'Newest'], ['votes', 'Most votes']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                aria-pressed={sortBy === key}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  sortBy === key ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
        {(() => {
          // Sorted on a copy: `polls` is server state and mutating it would make
          // the next reconcile compare against a reordered array.
          const ordered = sortBy === 'votes'
            ? [...(polls || [])].sort((a, b) => (b.totalVoters || 0) - (a.totalVoters || 0))
            : (polls || []);
          return (initialLimit > 0 && !showAll ? ordered.slice(0, initialLimit) : ordered);
        })().map((poll) => {
          const selected = selectedFor(poll);
          const saved = myVote(poll, name);
          const dirty = !sameSet(selected, saved);
          const maxCount = Math.max(1, ...poll.options.map((o) => poll.results[o.id] || 0));
          return (
            <div
              key={poll.id}
              id={`poll-${poll.id}`}
              className={`card card-pad ${poll.closed ? 'opacity-80' : ''} ${
                highlightId === poll.id ? 'ring-2 ring-[var(--gold-edge)]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold tracking-tight break-words">{poll.question}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-muted">
                    <span className="pill pill-mute">{poll.multi ? 'Pick any' : 'Pick one'}</span>
                    <span className="text-xs">{poll.totalVoters} {poll.totalVoters === 1 ? 'voter' : 'voters'}</span>
                    {poll.closed && <span className="pill pill-warn">closed</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyPollLink(poll)}
                  title="Copy a link to this poll"
                  aria-label={`Copy a link to the poll: ${poll.question}`}
                  className="tap-target flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copiedId === poll.id
                    ? (<><Check size={13} strokeWidth={2.5} /> Copied</>)
                    : (<><Link2 size={13} /> Share</>)}
                </button>
              </div>

              <div
                className="mt-4 space-y-2"
                role={poll.multi ? 'group' : 'radiogroup'}
                aria-label={poll.question}
              >
                {poll.options.map((opt, optIndex) => {
                  const count = poll.results[opt.id] || 0;
                  const isSel = selected.includes(opt.id);
                  const voters = poll.voters[opt.id] || [];
                  const barPct = (count / maxCount) * 100;
                  // One tab stop for the whole group, as a radio group has: Tab
                  // reaches it, arrows move within it.
                  const roving = focusedOpt[poll.id] ?? (selected[0] || poll.options[0].id);
                  return (
                    <button
                      key={opt.id}
                      id={`opt-${poll.id}-${opt.id}`}
                      role={poll.multi ? 'checkbox' : 'radio'}
                      aria-checked={isSel}
                      tabIndex={poll.multi ? 0 : (roving === opt.id ? 0 : -1)}
                      onKeyDown={(e) => onOptionKeyDown(e, poll, optIndex)}
                      onFocus={() => setFocusedOpt((f) => ({ ...f, [poll.id]: opt.id }))}
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

      {initialLimit > 0 && !showAll && (polls?.length || 0) > initialLimit && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full rounded-lg border border-border bg-pill py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
        >
          Show all polls · {polls.length - initialLimit} more
        </button>
      )}

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

  // Say WHY the button is disabled. Before, Create just sat greyed out, and a
  // duplicate option was only caught by the server after submitting.
  const filled = options.filter((o) => o.trim());
  const dupe = (() => {
    const seen = new Map();
    for (const o of filled) {
      const k = optKey(o);
      if (seen.has(k)) return [seen.get(k), o.trim()];
      seen.set(k, o.trim());
    }
    return null;
  })();
  const problem = !question.trim()
    ? 'Add a question.'
    : filled.length < 2
      ? 'Add at least two options.'
      : dupe
        ? `"${dupe[0]}" and "${dupe[1]}" are the same option.`
        : null;
  const valid = !problem;

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
        aria-label="Poll question"
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
              aria-label={`Option ${i + 1}`}
              aria-invalid={Boolean(dupe) && optKey(opt) === optKey(dupe[1]) && opt.trim() !== ''}
              className={`flex-1 bg-background border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground ${
                dupe && optKey(opt) === optKey(dupe[1]) && opt.trim() ? 'border-warn' : 'border-border'
              }`}
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

      {problem && (
        <p className="mt-3 text-xs text-warn" role="status">{problem}</p>
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
