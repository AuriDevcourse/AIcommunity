import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

const CATEGORIES = [
  { key: 'general',  label: 'General' },
  { key: 'session',  label: 'Session' },
  { key: 'idea',     label: 'Idea' },
  { key: 'demo',     label: 'Demo signup' },
  { key: 'venue',    label: 'Venue' },
  { key: 'signal',   label: 'WhatsApp signal' },
];

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('general');
  const [from, setFrom] = useState('');
  const [status, setStatus] = useState('idle');
  const [recent, setRecent] = useState([]);
  const taRef = useRef(null);

  useEffect(() => {
    if (open && taRef.current) taRef.current.focus();
    if (open) loadRecent();
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && open) submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function loadRecent() {
    try {
      const r = await fetch('/api/feedback');
      const j = await r.json();
      setRecent(j.entries?.slice(0, 5) || []);
    } catch {
      setRecent([]);
    }
  }

  async function submit() {
    if (!text.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category, from: from || 'anon' }),
      });
      const j = await r.json();
      if (j.ok) {
        setStatus('sent');
        setText('');
        loadRecent();
        setTimeout(() => setStatus('idle'), 1500);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6 shadow-[0_30px_60px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="h-section">Drop a thought</div>
                <h2 className="text-lg font-semibold mt-1 tracking-tight">What's on your mind?</h2>
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
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c.key
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                  }`}
                >{c.label}</button>
              ))}
            </div>

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
              className="w-full bg-background border border-border rounded-md p-3 text-sm text-foreground focus:outline-none focus:border-foreground resize-none font-sans"
            />

            <div className="flex items-center gap-2 mt-3">
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="From (optional)"
                className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground"
              />
              <span className="text-[10px] text-muted num">⌘↵ to send</span>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-muted">
                Saved to <span className="font-mono text-foreground">data/feedback.md</span>
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
              >
                {status === 'sending' ? 'Saving…' : status === 'sent' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
              </button>
            </div>

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
