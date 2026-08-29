import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { getJson, ApiUnavailableError } from '../lib/api.js';
import { useModal } from '../lib/useModal.js';

// Area 9.3 — the category changed the placeholder but never explained itself.
const CATEGORIES = [
  { key: 'general', label: 'General', hint: 'Anything that does not fit the others.' },
  { key: 'session', label: 'Session', hint: 'What worked, what did not, what should change.' },
  { key: 'idea', label: 'Idea', hint: 'Something you would like the group to try.' },
  { key: 'demo', label: 'Demo signup', hint: 'You want a slot to show something.' },
  { key: 'venue', label: 'Venue', hint: 'A room we could use, or a problem with the current one.' },
  { key: 'signal', label: 'WhatsApp signal', hint: 'Worth capturing out of the group chat.' },
];

// Matches LIMITS.FEEDBACK_MAX on the server, which truncates silently past this.
const TEXT_MAX = 4000;
const DRAFT_KEY = 'aiworkshop:feedback-draft';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  // Area 9.5 — losing a half-written thought to a stray Escape is infuriating.
  const [text, setText] = useState(() => {
    try { return window.localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
  });
  const [category, setCategory] = useState('general');
  const [from, setFrom] = useState('');
  const [status, setStatus] = useState('idle');
  const [recent, setRecent] = useState([]);
  const [count, setCount] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  // Area 9.4 — a submit that silently fails offline is worse than a disabled button.
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [errorMsg, setErrorMsg] = useState('');
  const taRef = useRef(null);
  const dialogRef = useModal({ open, onClose: () => setOpen(false) });

  // Probe once on mount, not on open: discovering there is no backend only
  // after the user clicks would make the button vanish mid-interaction.
  useEffect(() => { loadRecent(); }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Persist the draft as it is typed, and clear it once it is safely stored.
  useEffect(() => {
    try {
      if (text) window.localStorage.setItem(DRAFT_KEY, text);
      else window.localStorage.removeItem(DRAFT_KEY);
    } catch { /* private mode */ }
  }, [text]);

  useEffect(() => {
    if (open && taRef.current) taRef.current.focus();
    if (open) loadRecent();
  }, [open]);

  // Escape, the focus trap and the scroll lock live in useModal. This effect is
  // only the ⌘↵ shortcut — and it now declares its dependencies instead of
  // re-binding a listener on every single render.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, text, category, from, status]);

  async function loadRecent() {
    try {
      const j = await getJson('/api/feedback');
      setRecent(j.entries?.slice(0, 5) || []);
      setCount(typeof j.count === 'number' ? j.count : (j.entries?.length ?? null));
      setUnavailable(false);
    } catch (err) {
      setRecent([]);
      if (err instanceof ApiUnavailableError) setUnavailable(true);
    }
  }

  async function submit() {
    // Area 9.9
    if (!text.trim()) { setErrorMsg('Write something first.'); return; }
    if (text.length > TEXT_MAX) { setErrorMsg(`That is ${text.length - TEXT_MAX} characters over the limit.`); return; }
    if (!online) { setErrorMsg('You are offline — this will not send until you reconnect.'); return; }
    if (status === 'sending') return;

    setStatus('sending');
    setErrorMsg('');
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category, from: from || 'anon' }),
      });
      // Area 9.6 — 429 is a specific, recoverable condition; say so.
      if (r.status === 429) {
        setStatus('error');
        setErrorMsg('Too many submissions in the last minute. Try again shortly.');
        return;
      }
      const j = await r.json();
      if (j.ok) {
        setStatus('sent');
        setText('');
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
        loadRecent();
        setTimeout(() => setStatus('idle'), 2500);
      } else {
        setStatus('error');
        setErrorMsg(j.error || 'Could not save that.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not reach the server.');
    }
  }

  // No backend on this deployment — a button that can only fail is worse than
  // no button.
  if (unavailable) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-[0_20px_40px_rgba(0,0,0,0.18)] transition-transform hover:scale-105"
        title="Add feedback / signal"
      >
        <Plus size={14} strokeWidth={2.5} />
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-soft backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            tabIndex={-1}
            className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="h-section">Drop a thought</div>
                <h2 id="feedback-title" className="text-lg font-semibold mt-1 tracking-tight">What's on your mind?</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  aria-pressed={category === c.key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c.key
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                  }`}
                >{c.label}</button>
              ))}
            </div>
            <p className="text-xs text-muted -mt-1 mb-2">
              {CATEGORIES.find((c) => c.key === category)?.hint}
            </p>

            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                category === 'demo'    ? "Who wants to demo what? (e.g. 'Sany — programming basics, ready')" :
                category === 'signal'  ? "Something worth capturing from WhatsApp..." :
                category === 'session' ? "What worked, what didn't, what should change?" :
                                         "Anything — idea, observation, todo, feedback..."
              }
              rows={5}
              className="w-full bg-background border border-border rounded-md p-3 text-sm text-foreground focus:border-foreground resize-none font-sans"
            />

            {/* Area 9.1 — the server truncates at 4000 characters; say so before
                someone loses the end of a long note. */}
            <div className="mt-1 flex justify-end">
              <span
                className={`text-[10px] num ${text.length > TEXT_MAX ? 'text-err font-semibold' : 'text-muted'}`}
              >
                {text.length.toLocaleString()} / {TEXT_MAX.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <label className="sr-only" htmlFor="feedback-from">Your name (optional)</label>
              <input
                id="feedback-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="From (optional)"
                autoComplete="name"
                className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:border-foreground"
              />
              <span className="text-[10px] text-muted num hidden sm:inline">⌘↵ to send</span>
            </div>

            {!online && (
              <p className="mt-2 rounded-md border border-warn/40 bg-warn/5 px-2.5 py-1.5 text-xs text-foreground">
                You are offline. Your draft is saved locally and will still be here when you reconnect.
              </p>
            )}

            {errorMsg && (
              <p role="alert" className="mt-2 rounded-md border border-err/40 bg-err/10 px-2.5 py-1.5 text-xs text-err">
                {errorMsg}
              </p>
            )}

            {/* Area 9.2 */}
            {status === 'sent' && (
              <p role="status" className="mt-3 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-1.5 text-xs text-foreground">
                Saved. Auri reads these before each session and at the quarterly health check — you do not
                need to follow up.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 mt-4">
              {/* Area 9.8 */}
              <div className="text-xs text-muted">
                Goes to the organiser&rsquo;s private log. Leave the name blank to send it anonymously.
              </div>
              <button
                onClick={submit}
                disabled={!text.trim() || status === 'sending'}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  status === 'sent'
                    ? 'bg-ok text-background'
                    : status === 'error'
                    ? 'bg-err text-background'
                    : 'bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]'
                }`}
                aria-live="polite"
              >
                {status === 'sending' ? 'Saving…' : status === 'sent' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
              </button>
            </div>

            {recent.length === 0 && count > 0 && (
              <div className="mt-5 pt-4 border-t border-border text-xs text-muted">
                <span className="num">{count}</span> {count === 1 ? 'entry' : 'entries'} in the log so far.
                Contents are private — read them in the{' '}
                <span className="font-mono text-foreground">feedback.md</span> log on the server.
              </div>
            )}

            {recent.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="h-section mb-2">Recent</div>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {recent.map((r, i) => (
                    <li key={i} className="text-xs">
                      <div className="flex items-center gap-2 text-muted">
                        <span className="num">{r.timestamp}</span>
                        <span className="pill pill-mute text-[10px]">{r.category}</span>
                        {r.from && r.from !== 'anon' && <span>· {r.from}</span>}
                      </div>
                      <div className="text-foreground mt-0.5 line-clamp-2">{r.text}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
