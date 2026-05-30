import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Clock, ChevronLeft, ChevronRight, X, ExternalLink, Presentation, Play, Copy, Check } from 'lucide-react';
import learn from '../../data/learn.json';

const LEVEL_PILL = {
  Beginner: 'pill-ok',
  Intermediate: 'pill-warn',
  Advanced: 'pill-err',
};

// Build the slide list for a tutorial: a cover, one slide per step, then a
// resources slide if there's anything to link.
function buildSlides(t) {
  const slides = [{ kind: 'cover', title: t.title, summary: t.summary, level: t.level, minutes: t.minutes }];
  (t.steps || []).forEach((s, i) => slides.push({ kind: 'step', n: i + 1, total: t.steps.length, title: s.title, body: s.body, code: s.code }));
  if (t.resources?.length || t.slides) slides.push({ kind: 'resources', resources: t.resources || [], slides: t.slides });
  return slides;
}

export default function Learn() {
  const tutorials = learn.tutorials || [];
  const [activeId, setActiveId] = useState(null);
  const [tag, setTag] = useState('all');

  const tags = useMemo(() => {
    const set = new Set();
    tutorials.forEach((t) => (t.tags || []).forEach((x) => set.add(x)));
    return ['all', ...[...set].sort()];
  }, [tutorials]);

  const shown = tag === 'all' ? tutorials : tutorials.filter((t) => (t.tags || []).includes(tag));
  const active = tutorials.find((t) => t.id === activeId) || null;

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <GraduationCap size={11} strokeWidth={2.2} />
        <span>Learn</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight mt-1">Build with AI</h2>
      <p className="text-sm text-muted mt-1 max-w-2xl">Short, practical decks from our sessions. Open one and click through the slides.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              tag === t ? 'bg-foreground text-background border-foreground' : 'bg-pill text-foreground border-border hover:bg-accent'
            }`}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card card-pad mt-5 text-sm text-muted text-center">No guides with that tag yet.</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((t) => {
            const levelPill = LEVEL_PILL[t.level] || 'pill-mute';
            const slideCount = buildSlides(t).length;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className="warm-card card-interactive p-5 text-left flex flex-col h-full"
              >
                <div className="flex items-center gap-2">
                  <span className={`pill ${levelPill}`}>{t.level}</span>
                  {t.minutes && <span className="inline-flex items-center gap-1 text-[11px] text-muted num"><Clock size={11} /> {t.minutes} min</span>}
                </div>
                <h3 className="mt-3 text-base font-semibold tracking-tight leading-snug">{t.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{t.summary}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted num">{slideCount} slides</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Play size={13} strokeWidth={2.5} /> Start
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && <SlideViewer key={active.id} tutorial={active} onClose={() => setActiveId(null)} />}
    </div>
  );
}

function SlideViewer({ tutorial, onClose }) {
  const slides = useMemo(() => buildSlides(tutorial), [tutorial]);
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const total = slides.length;
  const go = (d) => setI((x) => Math.min(total - 1, Math.max(0, x + d)));

  useEffect(() => { setCopied(false); }, [i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  const s = slides[i];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 border-b border-border">
        <span className="text-xs text-muted num">{i + 1} / {total}</span>
        <span className="text-xs font-medium text-muted truncate">{tutorial.title}</span>
        <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-accent transition-colors" aria-label="Close"><X size={18} /></button>
      </div>

      {/* Slide (fills the screen) */}
      <div className="flex-1 overflow-y-auto flex px-6 sm:px-10 py-8">
        <div className="m-auto w-full max-w-3xl">
          {s.kind === 'cover' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className={`pill ${LEVEL_PILL[s.level] || 'pill-mute'}`}>{s.level}</span>
                {s.minutes && <span className="inline-flex items-center gap-1 text-xs text-muted num"><Clock size={12} /> {s.minutes} min</span>}
              </div>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-4 text-lg text-muted leading-relaxed max-w-xl mx-auto">{s.summary}</p>
              <button onClick={() => go(1)} className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]">
                Start <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {s.kind === 'step' && (
            <div>
              <div className="h-section">Step {s.n} of {s.total}</div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-4 text-lg text-muted leading-relaxed">{s.body}</p>
              {s.code && (
                <div className="relative mt-6 max-w-xl">
                  <pre className="rounded-xl bg-accent border border-border p-4 pr-12 text-sm num overflow-x-auto"><code>{s.code}</code></pre>
                  <button
                    onClick={() => copyCode(s.code)}
                    className="absolute top-2.5 right-2.5 grid place-items-center w-8 h-8 rounded-lg bg-background border border-border text-muted hover:text-foreground transition-colors"
                    aria-label="Copy command"
                  >
                    {copied ? <Check size={15} strokeWidth={2.5} className="text-ok" /> : <Copy size={15} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {s.kind === 'resources' && (
            <div className="text-center">
              <div className="h-section">Keep going</div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight">Resources</h2>
              <div className="mt-6 flex flex-col gap-2 max-w-md mx-auto text-left">
                {s.slides && (
                  <a href={s.slides} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-pill px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                    <span className="inline-flex items-center gap-2"><Presentation size={15} /> Full slide deck</span>
                    <ExternalLink size={14} className="text-muted" />
                  </a>
                )}
                {s.resources.map((r) => (
                  <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-pill px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                    <span>{r.label}</span>
                    <ExternalLink size={14} className="text-muted" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 border-t border-border">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="grid place-items-center w-10 h-10 rounded-full border border-border bg-background text-foreground transition disabled:opacity-30 enabled:hover:bg-accent"
          aria-label="Previous slide"
        ><ChevronLeft size={18} /></button>

        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-foreground' : 'w-1.5 bg-border hover:bg-muted'}`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={i === total - 1}
          className="grid place-items-center w-10 h-10 rounded-full border border-border bg-background text-foreground transition disabled:opacity-30 enabled:hover:bg-accent"
          aria-label="Next slide"
        ><ChevronRight size={18} /></button>
      </div>
    </div>,
    document.body
  );
}
