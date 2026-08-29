import { useEffect, useState } from 'react';
import { Plus, Check, Loader2, ListPlus, X, BarChart3, Trash2 } from 'lucide-react';
import { getJson, ApiUnavailableError } from '../lib/api.js';
import { useModal } from '../lib/useModal.js';

const NAME_KEY = 'aiworkshop:poll-name';
// Server-minted identity. A typed name is a label, not a credential — this is
// what actually proves "my vote" and "my poll" to the API.
const TOKEN_KEY = 'aiworkshop:poll-token';

function readToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function saveToken(token) {
  if (!token) return;
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch {}
}

// Identity travels in a header on every call, so it never lands in a URL or a
// server log. Responses may mint a token, which we persist for next time.
function authHeaders(extra) {
  const token = readToken();
  return { ...extra, ...(token ? { 'X-Voter-Token': token } : {}) };
}

async function postJson(url, method, payload) {
  const r = await fetch(url, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (j?.token) saveToken(j.token);
  if (j?.creatorToken) saveToken(j.creatorToken);
  return j;
}

export default function TopicPoll() {
  const [state, setState] = useState(null);
  const [name, setName] = useState(() => (typeof window !== 'undefined' ? window.localStorage.getItem(NAME_KEY) || '' : ''));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Area 5.4 — by insertion order (how the room added them) or by score.
  const [sortBy, setSortBy] = useState('order');

  useEffect(() => { load(); }, []);

  function persistName(v) {
    setName(v);
    try { window.localStorage.setItem(NAME_KEY, v); } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      setState(await getJson('/api/poll', { headers: authHeaders() }));
      setError('');
      setUnavailable(false);
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        // Static deploy: not an error, just a deployment without a backend.
        setUnavailable(true);
        setError('');
      } else {
        setError('Could not load polls.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (unavailable) {
    return (
      <div className="card card-pad">
        <div className="h-section flex items-center gap-1.5">
          <BarChart3 size={11} strokeWidth={2.2} />
          <span>Community polls</span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Polls need the Node server — this is a static deployment. Run{' '}
          <span className="font-mono text-foreground">npm start</span> (or{' '}
          <span className="font-mono text-foreground">npm run dev</span>) to vote.
        </p>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="h-section flex items-center gap-1.5">
          <BarChart3 size={11} strokeWidth={2.2} />
          <span>Community polls</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="poll-name">Your display name for polls</label>
          <input
            id="poll-name"
            value={name}
            onChange={(e) => persistName(e.target.value)}
            placeholder="Your name"
            maxLength={64}
            autoComplete="name"
            className="bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground w-28 sm:w-36 focus:border-foreground"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background hover:scale-[1.02] transition"
          >
            <ListPlus size={12} strokeWidth={2.5} />
            New
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-2 rounded-md border border-err/40 bg-err/10 text-err px-2.5 py-1.5 text-xs">{error}</div>
      )}

      {/* Area 5.6 — a vote changes numbers a screen reader would otherwise miss. */}
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {/* Be honest about the identity model: the server keys votes on a token
          stored in this browser, so "one vote per person" is really one per
          browser profile. */}
      {!loading && state?.polls?.length > 0 && (
        <p className="text-[11px] text-muted mb-3">
          One vote per browser — your name is just a label. Clearing site data starts a new identity.
        </p>
      )}

      {loading ? (
        /* Area 5.1 — a skeleton in the shape of the result reserves the space
           and avoids the card collapsing then jumping when data lands. */
        <div className="space-y-4 py-1" aria-busy="true" aria-label="Loading polls">
          {[0, 1].map((i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-7 w-full" />
              <div className="skeleton h-7 w-full" />
            </div>
          ))}
        </div>
      ) : !state?.polls.length ? (
        <div className="text-xs text-muted py-2">
          No polls yet — click <span className="font-semibold text-foreground">New</span> to start one.
        </div>
      ) : (
        <div className="space-y-4">
          {state.polls.length > 1 || state.polls.some((p) => p.options.length > 1) ? (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span id="poll-sort-label">Sort options</span>
              <div className="flex gap-1" role="group" aria-labelledby="poll-sort-label">
                {[['order', 'As added'], ['votes', 'Most votes']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    aria-pressed={sortBy === key}
                    className={`rounded-full border px-2 py-0.5 transition-colors ${
                      sortBy === key
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
          ) : null}
          {state.polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              name={name}
              sortBy={sortBy}
              onChange={(next) => setState(next)}
              onError={setError}
              onAnnounce={setAnnouncement}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePollModal
          name={name}
          onClose={() => setShowCreate(false)}
          onCreated={(next) => { setState(next); setShowCreate(false); }}
          onError={setError}
          onNameChange={persistName}
        />
      )}
    </div>
  );
}

function PollCard({ poll, name, sortBy, onChange, onError, onAnnounce }) {
  const [busyOptionId, setBusyOptionId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Area 5.2 — the tally is echoed locally the instant you click, then replaced
  // by the server's copy. Rolled back if the request fails.
  const [pending, setPending] = useState(null);

  // Both flags come from the server, keyed on this browser's token — a typed
  // name is a display label and must never grant permissions.
  const currentVoteId = pending !== null ? pending : poll.myVote || null;
  const totalVotes = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  const isCreator = Boolean(poll.mine);
  const canAdd = poll.allowSuggestions || isCreator;

  // Area 5.4 — a stable copy, sorted on demand; never mutate the prop array.
  const orderedOptions =
    sortBy === 'votes'
      ? [...poll.options].sort((a, b) => (b.votes || 0) - (a.votes || 0))
      : poll.options;

  // Area 5.5 — roving movement inside the group, wrapping at both ends.
  function onOptionKeyDown(e) {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    const nodes = [...e.currentTarget.querySelectorAll('[role="radio"]:not([disabled])')];
    if (nodes.length === 0) return;
    const i = nodes.indexOf(document.activeElement);
    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const nextIndex = i === -1 ? 0 : (i + (forward ? 1 : -1) + nodes.length) % nodes.length;
    e.preventDefault();
    nodes[nextIndex].focus();
  }

  async function vote(optionId) {
    if (!name.trim()) { onError('Add your name above first.'); return; }
    const previous = poll.myVote || null;
    setPending(optionId);
    setBusyOptionId(optionId);
    onError('');
    try {
      const j = await postJson(`/api/poll/${encodeURIComponent(poll.id)}/vote`, 'POST', { optionId, name: name.trim() });
      if (j.ok) {
        onChange(j.state);
        const label = poll.options.find((o) => o.id === optionId)?.text;
        onAnnounce?.(`Voted for ${label}.`);
      } else {
        setPending(previous);
        onError(j.error || 'Vote failed.');
      }
    } catch {
      setPending(previous);
      onError(navigator.onLine === false ? 'You appear to be offline — the vote was not saved.' : 'Vote failed.');
    } finally { setBusyOptionId(null); setPending(null); }
  }

  async function unvote(optionId) {
    if (!name.trim()) return;
    setBusyOptionId(optionId);
    onError('');
    try {
      const j = await postJson(`/api/poll/${encodeURIComponent(poll.id)}/vote`, 'DELETE', { name: name.trim() });
      if (j.ok) { onChange(j.state); onAnnounce?.('Vote cleared.'); }
      else onError(j.error || 'Could not clear vote.');
    } catch { onError('Could not clear vote.'); }
    finally { setBusyOptionId(null); }
  }

  async function deletePoll() {
    if (!isCreator) return;
    setDeleting(true);
    onError('');
    try {
      const j = await postJson(`/api/poll/${encodeURIComponent(poll.id)}`, 'DELETE', { name: name.trim() });
      if (j.ok) onChange(j.state); else onError(j.error || 'Could not delete poll.');
    } catch { onError('Could not delete poll.'); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  async function addOption() {
    const text = newOption.trim();
    if (!text || !name.trim()) { onError(!name.trim() ? 'Add your name above first.' : 'Type an option.'); return; }
    setAdding(true);
    onError('');
    try {
      const j = await postJson(`/api/poll/${encodeURIComponent(poll.id)}/option`, 'POST', { text, name: name.trim() });
      if (j.ok) {
        onChange(j.state);
        setNewOption('');
        // Area 5.9 — the API reports duplicates; silently succeeding looked broken.
        onAnnounce?.(j.duplicate ? 'That option already existed — your suggestion was merged.' : `Added ${text}.`);
        if (j.duplicate) onError('That option already existed, so it was merged with the existing one.');
      } else onError(j.error || 'Could not add option.');
    } catch { onError('Could not add option.'); }
    finally { setAdding(false); }
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
        <h3 id={`poll-q-${poll.id}`} className="text-sm sm:text-base font-semibold tracking-tight text-foreground min-w-0">
          {poll.question}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-muted whitespace-nowrap">
          <span className="num">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} · by {poll.createdBy}</span>
          {isCreator && (
            confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={deletePoll}
                  disabled={deleting}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-err text-background hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded px-1.5 py-0.5 text-[10px] border border-border hover:bg-foreground/5"
                >Cancel</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-muted hover:text-err transition"
                title="Delete this poll"
                aria-label="Delete poll"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            )
          )}
        </div>
      </div>
      {poll.subtitle && <p className="text-xs text-muted -mt-1 mb-2">{poll.subtitle}</p>}

      {poll.options.length === 0 ? (
        <div className="text-xs text-muted py-2">
          No options yet{canAdd ? ' — add one below.' : '.'}
        </div>
      ) : (
        /* Area 5.5 — a vote list IS a radio group. Announcing it as one, with
           arrow-key movement, matches what assistive tech already expects. */
        <ul className="space-y-1" role="radiogroup" aria-labelledby={`poll-q-${poll.id}`} onKeyDown={onOptionKeyDown}>
          {orderedOptions.map((o) => {
            const isMine = o.id === currentVoteId;
            const busy = busyOptionId === o.id;
            const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
            const votersLabel = o.voters?.length
              ? o.voters.length <= 3
                ? o.voters.join(', ')
                : `${o.voters.slice(0, 2).join(', ')} +${o.voters.length - 2}`
              : '';
            return (
              <li key={o.id}>
                <button
                  role="radio"
                  aria-checked={isMine}
                  data-option-id={o.id}
                  onClick={() => !busy && (isMine ? unvote(o.id) : vote(o.id))}
                  disabled={busy || !name.trim()}
                  className={`relative w-full text-left rounded-md border overflow-hidden transition group disabled:cursor-not-allowed ${
                    isMine
                      ? 'border-foreground'
                      : 'border-border hover:border-foreground/40 disabled:hover:border-border'
                  }`}
                  title={!name.trim() ? 'Add your name first' : isMine ? 'Click to clear your vote' : 'Vote for this option'}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                      isMine ? 'bg-foreground/15' : 'bg-foreground/[0.06] group-hover:bg-foreground/10'
                    }`}
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2 px-2.5 py-1.5">
                    <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                      {busy ? (
                        <Loader2 size={12} className="animate-spin text-muted" />
                      ) : isMine ? (
                        <Check size={14} strokeWidth={2.5} className="text-foreground" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-border group-hover:border-foreground transition" />
                      )}
                    </span>
                    <span className={`flex-1 min-w-0 truncate text-sm ${isMine ? 'font-semibold' : 'font-medium'}`}>
                      {o.text}
                    </span>
                    {votersLabel && (
                      <span className="hidden sm:inline text-[10px] text-muted truncate max-w-[40%]" title={o.voters.join(', ')}>
                        {votersLabel}
                      </span>
                    )}
                    <span className="text-xs text-muted num whitespace-nowrap">
                      {pct}% <span className="text-foreground font-semibold">{o.votes}</span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd && (
        <div className="flex items-center gap-1.5 mt-2">
          <input
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !adding) addOption(); }}
            placeholder={poll.allowSuggestions ? 'Suggest an option…' : 'Add another option (you only)…'}
            maxLength={200}
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:border-foreground"
          />
          <button
            onClick={addOption}
            disabled={adding || !newOption.trim() || !name.trim()}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.5} />}
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function CreatePollModal({ name, onClose, onCreated, onError, onNameChange }) {
  const dialogRef = useModal({ open: true, onClose });
  const [question, setQuestion] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [allowSuggestions, setAllowSuggestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localName, setLocalName] = useState(name);

  async function submit() {
    if (!question.trim() || !localName.trim()) return;
    setSubmitting(true);
    onError('');
    try {
      const j = await postJson('/api/poll', 'POST', {
        question: question.trim(),
        subtitle: subtitle.trim(),
        allowSuggestions,
        name: localName.trim(),
      });
      if (j.ok) {
        onNameChange(localName.trim());
        onCreated(j.state);
      } else onError(j.error || 'Could not create poll.');
    } catch { onError('Could not create poll.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-soft backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-poll-title"
        tabIndex={-1}
        className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="h-section">Create poll</div>
            <h2 id="create-poll-title" className="text-lg font-semibold mt-1 tracking-tight">Ask the room something</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="h-section block mb-1">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What should we cover at the next session?"
              maxLength={200}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:border-foreground"
              autoFocus
            />
          </div>
          <div>
            <label className="h-section block mb-1">Subtitle (optional)</label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Context, deadline, or anything to clarify"
              maxLength={400}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:border-foreground"
            />
          </div>
          <div>
            <label className="h-section block mb-1">Your name</label>
            <input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g. Auri"
              maxLength={64}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:border-foreground"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowSuggestions}
              onChange={(e) => setAllowSuggestions(e.target.checked)}
              className="mt-0.5 accent-foreground"
            />
            <span className="text-sm">
              <span className="text-foreground font-medium">Allow members to suggest options</span>
              <span className="block text-xs text-muted mt-0.5">
                If off, only you (the creator) can add options.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm border border-border hover:bg-foreground hover:text-background transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !question.trim() || !localName.trim()}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition"
          >
            {submitting ? 'Creating…' : 'Create poll'}
          </button>
        </div>
      </div>
    </div>
  );
}
