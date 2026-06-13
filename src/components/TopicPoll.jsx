import { useEffect, useState } from 'react';
import { Plus, Check, Loader2, ListPlus, X, BarChart3, Trash2 } from 'lucide-react';

const NAME_KEY = 'aiworkshop:poll-name';

export default function TopicPoll() {
  const [state, setState] = useState(null);
  const [name, setName] = useState(() => (typeof window !== 'undefined' ? window.localStorage.getItem(NAME_KEY) || '' : ''));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);

  function persistName(v) {
    setName(v);
    try { window.localStorage.setItem(NAME_KEY, v); } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/poll');
      setState(await r.json());
      setError('');
    } catch {
      setError('Could not load polls.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="h-section flex items-center gap-1.5">
          <BarChart3 size={11} strokeWidth={2.2} />
          <span>Community polls</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => persistName(e.target.value)}
            placeholder="Your name"
            maxLength={64}
            className="bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground w-28 sm:w-36 focus:outline-none focus:border-foreground"
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
        <div className="mb-2 rounded-md border border-err/40 bg-err/10 text-err px-2.5 py-1.5 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="text-xs text-muted flex items-center gap-2 py-2">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : !state?.polls.length ? (
        <div className="text-xs text-muted py-2">
          No polls yet — click <span className="font-semibold text-foreground">New</span> to start one.
        </div>
      ) : (
        <div className="space-y-4">
          {state.polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              name={name}
              onChange={(next) => setState(next)}
              onError={setError}
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

function PollCard({ poll, name, onChange, onError }) {
  const [busyOptionId, setBusyOptionId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const normName = name.trim().toLowerCase();
  const currentVoteId = poll.options.find((o) => o.voters?.some((v) => v.trim().toLowerCase() === normName))?.id;
  const totalVotes = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  const isCreator = normName && normName === poll.createdBy.trim().toLowerCase();
  const canAdd = poll.allowSuggestions || isCreator;

  async function vote(optionId) {
    if (!name.trim()) { onError('Add your name above first.'); return; }
    setBusyOptionId(optionId);
    onError('');
    try {
      const r = await fetch(`/api/poll/${encodeURIComponent(poll.id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, name: name.trim() }),
      });
      const j = await r.json();
      if (j.ok) onChange(j.state); else onError(j.error || 'Vote failed.');
    } catch { onError('Vote failed.'); }
    finally { setBusyOptionId(null); }
  }

  async function unvote(optionId) {
    if (!name.trim()) return;
    setBusyOptionId(optionId);
    onError('');
    try {
      const r = await fetch(`/api/poll/${encodeURIComponent(poll.id)}/vote`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await r.json();
      if (j.ok) onChange(j.state); else onError(j.error || 'Could not clear vote.');
    } catch { onError('Could not clear vote.'); }
    finally { setBusyOptionId(null); }
  }

  async function deletePoll() {
    if (!isCreator) return;
    setDeleting(true);
    onError('');
    try {
      const r = await fetch(`/api/poll/${encodeURIComponent(poll.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await r.json();
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
      const r = await fetch(`/api/poll/${encodeURIComponent(poll.id)}/option`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name: name.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        onChange(j.state);
        setNewOption('');
      } else onError(j.error || 'Could not add option.');
    } catch { onError('Could not add option.'); }
    finally { setAdding(false); }
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
        <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground min-w-0">
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
        <ul className="space-y-1">
          {poll.options.map((o) => {
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
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground"
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
      const r = await fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          subtitle: subtitle.trim(),
          allowSuggestions,
          name: localName.trim(),
        }),
      });
      const j = await r.json();
      if (j.ok) {
        onNameChange(localName.trim());
        onCreated(j.state);
      } else onError(j.error || 'Could not create poll.');
    } catch { onError('Could not create poll.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="h-section">Create poll</div>
            <h2 className="text-lg font-semibold mt-1 tracking-tight">Ask the room something</h2>
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
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
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
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
            />
          </div>
          <div>
            <label className="h-section block mb-1">Your name</label>
            <input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g. Auri"
              maxLength={64}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
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
