import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Clock, ChevronLeft, ChevronRight, X, ExternalLink, Presentation, Play, Copy, Check, ArrowRight, KeyRound, Server, Globe, Unlock, ShieldCheck, User, FileX, AlertTriangle } from 'lucide-react';
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
  (t.steps || []).forEach((s, i) => slides.push({ kind: 'step', n: i + 1, total: t.steps.length, title: s.title, body: s.body, code: s.code, image: s.image, diagram: s.diagram, demo: s.demo }));
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
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Build with AI</h1>
      <p className="text-sm text-muted mt-1 max-w-2xl">Short decks from our sessions.</p>

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
                  {t.minutes && <span className="inline-flex items-center gap-1 text-[11px] text-muted "><Clock size={11} /> {t.minutes} min</span>}
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight leading-snug">{t.title}</h2>
                <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{t.summary}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted ">{slideCount} slides</span>
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
  const [edge, setEdge] = useState(null); // 'left' | 'right' | null: which nav circle to reveal
  const total = slides.length;
  const EDGE = 0.25; // fraction of width near each side that navigates + reveals the circle
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

  // Click near the left edge to go back, near the right edge to advance.
  // The middle is left alone so reading and text selection still work, and
  // clicks on buttons, links or code blocks never trigger navigation.
  function onSlideClick(e) {
    if (e.target.closest('button, a, input, textarea, pre')) return;
    if (window.getSelection && window.getSelection().toString()) return;
    const el = e.currentTarget;
    const f = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth;
    if (f < EDGE) go(-1);
    else if (f > 1 - EDGE) go(1);
  }

  // Reveal a side's circle only once the pointer moves within EDGE of that edge,
  // not on general hover. Clears as the pointer returns to the middle or leaves.
  function onSlideMove(e) {
    const el = e.currentTarget;
    const f = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth;
    setEdge(f < EDGE ? 'left' : f > 1 - EDGE ? 'right' : null);
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

      {/* Slide area: the scroll container and the edge circles both live here,
          and overflow-hidden clips them to this band so nothing ever overlaps
          the top bar above or the controls below. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        className="no-scrollbar absolute inset-0 overflow-y-auto flex px-6 sm:px-10 py-8"
        onClick={onSlideClick}
        onMouseMove={onSlideMove}
        onMouseLeave={() => setEdge(null)}
      >
        <div className="m-auto w-full max-w-3xl">
          {s.kind === 'cover' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className={`pill ${LEVEL_PILL[s.level] || 'pill-mute'}`}>{s.level}</span>
                {s.minutes && <span className="inline-flex items-center gap-1 text-xs text-muted "><Clock size={12} /> {s.minutes} min</span>}
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
              {/* Visual: a real screenshot if one is supplied, otherwise the
                  built-in diagram for this step. Drop an image path into the
                  step's `image` field later to replace the diagram. */}
              {s.image ? (
                <img src={s.image} alt="" className="mt-6 w-full max-w-xl rounded-xl border border-border" />
              ) : s.diagram ? (
                <div className="mt-6 max-w-xl"><StepDiagram kind={s.diagram} /></div>
              ) : null}

              {s.demo === 'xss' && <div className="mt-6"><XssDemo /></div>}

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

      {/* Click-zone thresholds (visual only): a large filled circle centred on
          each side edge, so only its bulge shows on the slide. It appears only
          once the pointer moves within the edge zone, marking where a click
          skips the slide. Very low opacity, pointer-events-none. */}
      {i > 0 && (
        <>
          <div
            className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-foreground transition-opacity duration-300"
            style={{ width: '28vw', height: '150%', borderRadius: '50%', opacity: edge === 'left' ? 0.06 : 0 }}
          />
          <ChevronLeft
            size={26}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-[7vw] top-1/2 -translate-y-1/2 text-muted transition-opacity duration-300"
            style={{ opacity: edge === 'left' ? 0.7 : 0 }}
          />
        </>
      )}
      {i < total - 1 && (
        <>
          <div
            className="pointer-events-none absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 bg-foreground transition-opacity duration-300"
            style={{ width: '28vw', height: '150%', borderRadius: '50%', opacity: edge === 'right' ? 0.06 : 0 }}
          />
          <ChevronRight
            size={26}
            strokeWidth={1.75}
            className="pointer-events-none absolute right-[7vw] top-1/2 -translate-y-1/2 text-muted transition-opacity duration-300"
            style={{ opacity: edge === 'right' ? 0.7 : 0 }}
          />
        </>
      )}
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

/* --------------------------------------------------------------------------
   Step diagrams. Small, theme-aware illustrations built from the app's own
   tokens + Lucide icons, one per security concept. Each is a stand-in a real
   screenshot can replace later via the step's `image` field.
   -------------------------------------------------------------------------- */

function DiaBox({ icon: Icon, label, tone = 'mute', note }) {
  const tint = tone === 'err' ? 'border-err/40 text-err' : tone === 'ok' ? 'border-ok/50 text-ok' : 'border-border text-foreground';
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className={`grid place-items-center w-16 h-16 rounded-xl border bg-background ${tint}`}>
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <span className="text-xs font-medium">{label}</span>
      {note && <span className="text-[10px] text-muted leading-tight max-w-[7rem]">{note}</span>}
    </div>
  );
}

function StepDiagram({ kind }) {
  const wrap = 'rounded-xl border border-border bg-pill p-5';

  if (kind === 'flow-keys') {
    return (
      <div className={wrap}>
        <div className="flex items-center justify-between gap-2">
          <DiaBox icon={Globe} label="Browser" note="what the visitor holds" />
          <ArrowRight size={18} className="text-muted flex-shrink-0" />
          <DiaBox icon={Server} label="Your server" tone="ok" note="the key lives here only" />
          <ArrowRight size={18} className="text-muted flex-shrink-0" />
          <DiaBox icon={KeyRound} label="OpenAI" note="paid API" />
        </div>
        <p className="mt-4 text-xs text-muted text-center">The browser calls your server. The secret key never leaves the server.</p>
      </div>
    );
  }

  if (kind === 'open-endpoint') {
    return (
      <div className={wrap}>
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1 text-muted text-[11px]">
            <span>anyone</span>
            <div className="flex flex-col gap-0.5">
              <ArrowRight size={16} /><ArrowRight size={16} /><ArrowRight size={16} />
            </div>
            <span>10,000x</span>
          </div>
          <div className="grid place-items-center w-24 h-20 rounded-xl border border-err/40 bg-background text-err">
            <Unlock size={22} strokeWidth={1.75} />
            <span className="mt-1 text-[11px] num">/api/chat</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted text-center">No login, no limit. Every call spends your money. The fix: a login and a 429 rate limit.</p>
      </div>
    );
  }

  if (kind === 'idor') {
    return (
      <div className={wrap}>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="num text-sm rounded-lg border border-border bg-background px-3 py-2">/order/<b className="text-foreground">1042</b></span>
          <ArrowRight size={18} className="text-muted" />
          <span className="num text-sm rounded-lg border border-err/40 bg-background px-3 py-2 text-err">/order/<b>1043</b></span>
          <ArrowRight size={18} className="text-muted" />
          <span className="inline-flex items-center gap-1.5 text-xs text-err"><User size={16} /> someone else&apos;s data</span>
        </div>
        <p className="mt-4 text-xs text-muted text-center">The fix: tie every lookup to the logged-in user, so a stranger&apos;s id returns <span className="inline-flex items-center gap-1 text-ok"><ShieldCheck size={13} /> 403</span>.</p>
      </div>
    );
  }

  if (kind === 'paths') {
    return (
      <div className={wrap}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-err/40 bg-background px-3 py-2">
            <span className="num text-xs">yoursite.com/.env</span>
            <span className="inline-flex items-center gap-1 text-xs text-err"><AlertTriangle size={13} /> 200 · leaked</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-ok/50 bg-background px-3 py-2">
            <span className="num text-xs">yoursite.com/.env</span>
            <span className="inline-flex items-center gap-1 text-xs text-ok"><ShieldCheck size={13} /> 404 · closed</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted text-center">If secrets, <span className="num">.git</span>, or stack traces load in a browser, they are public. Every one should be a 404.</p>
      </div>
    );
  }

  return null;
}

/* --------------------------------------------------------------------------
   Live XSS demo. A safe, fully simulated demonstration: dangerous payloads are
   detected and shown as a mock "attack fired" result (nothing is ever executed
   and no dangerouslySetInnerHTML is used, so the deck itself stays clean), while
   a harmless <b>/<i> tag is rendered so you can see markup being interpreted.
   -------------------------------------------------------------------------- */

function isDangerous(v) {
  return /<script|<img|<svg|<iframe|on\w+\s*=|javascript:/i.test(v);
}

// Render only <b> and <i> as real formatting; everything else stays literal
// text (React escapes it). Used for the harmless case in the unsafe panel.
function renderMarkup(str) {
  const out = [];
  const re = /<(b|i)>([\s\S]*?)<\/\1>/gi;
  let last = 0, m, k = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const Tag = m[1].toLowerCase() === 'b' ? 'strong' : 'em';
    out.push(<Tag key={k++}>{m[2]}</Tag>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out.length ? out : [' '];
}

function XssDemo() {
  const [val, setVal] = useState('<b>hello</b>');
  const danger = isDangerous(val);
  return (
    <div className="rounded-xl border border-border bg-pill p-5 max-w-xl">
      <div className="h-section">Try it, safely</div>
      <p className="mt-2 text-sm text-muted">Type into this pretend comment box, or pick an example. Watch how the same text behaves when the site trusts it versus when it cleans it.</p>

      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="input mt-3 w-full num text-sm"
        aria-label="Comment text to test"
        placeholder="Type a comment"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => setVal('<b>hello</b>')} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors">Harmless tag</button>
        <button onClick={() => setVal('<img src=x onerror="stealCookie()">')} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors">Attack payload</button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-err/40 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-err"><Unlock size={13} /> No validation</div>
          <div className="mt-2 min-h-[2.5rem] text-sm">
            {danger ? (
              <span className="inline-flex items-start gap-1.5 text-err"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> Attack fired. The browser ran the injected code and your session cookie was just sent to attacker.com.</span>
            ) : (
              <span>{renderMarkup(val)}</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-ok/50 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ok"><ShieldCheck size={13} /> With validation</div>
          <div className="mt-2 min-h-[2.5rem] text-sm num break-words">{val || ' '}</div>
          <div className="mt-1 text-[10px] text-muted">Stored and shown as plain text. The tag never runs.</div>
        </div>
      </div>
    </div>
  );
}
