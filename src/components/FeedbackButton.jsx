import { useEffect, useRef, useState } from 'react';

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
        className="fixed bottom-6 right-6 z-40 bg-accent text-ink-950 font-semibold text-sm px-4 py-2.5 rounded-full shadow-lg shadow-accent/30 hover:scale-105 transition-transform flex items-center gap-2"
        title="Add feedback / signal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="h-section">Drop a thought</div>
                <h2 className="text-lg font-semibold mt-1">What's on your mind?</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-400 hover:text-ink-100 text-xl leading-none"
              >×</button>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    category === c.key
                      ? 'bg-accent text-ink-950 border-accent'
                      : 'bg-ink-800/60 text-ink-300 border-ink-700 hover:border-ink-600'
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
              className="w-full bg-ink-950/60 border border-ink-700 rounded-md p-3 text-sm text-ink-100 focus:outline-none focus:border-accent/60 resize-none font-sans"
            />

            <div className="flex items-center gap-2 mt-3">
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="From (optional)"
                className="flex-1 bg-ink-950/60 border border-ink-700 rounded-md px-3 py-1.5 text-xs text-ink-100 focus:outline-none focus:border-accent/60"
              />
              <span className="text-[10px] text-ink-500 num">⌘↵ to send</span>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-ink-500">
                Saved to <span className="font-mono text-ink-400">data/feedback.md</span>
              </div>
              <button
                onClick={submit}
                disabled={!text.trim() || status === 'sending'}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                  status === 'sent'
                    ? 'bg-ok text-ink-950'
                    : status === 'error'
                    ? 'bg-err text-ink-950'
                    : 'bg-accent text-ink-950 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]'
                }`}
              >
                {status === 'sending' ? 'Saving…' : status === 'sent' ? 'Saved ✓' : status === 'error' ? 'Error' : 'Save'}
              </button>
            </div>

            {recent.length > 0 && (
              <div className="mt-5 pt-4 border-t border-ink-800">
                <div className="h-section mb-2">Recent</div>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {recent.map((r, i) => (
                    <li key={i} className="text-xs">
                      <div className="flex items-center gap-2 text-ink-500">
                        <span className="num">{r.timestamp}</span>
                        <span className="pill pill-mute text-[10px]">{r.category}</span>
                        {r.from && r.from !== 'anon' && <span>· {r.from}</span>}
                      </div>
                      <div className="text-ink-300 mt-0.5 line-clamp-2">{r.text}</div>
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
