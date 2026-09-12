import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Clock, ChevronLeft, ChevronRight, X, ExternalLink, Presentation, Play, Copy, Check, ArrowRight, KeyRound, Server, Globe, Unlock, ShieldCheck, User, FileX, AlertTriangle, List, CheckCircle2, RotateCcw, Layers, Wrench, Circle, FileCode, ThumbsUp, ThumbsDown, Bot, Hammer, Flag, MemoryStick, Gauge, Terminal, Repeat, FileSearch, BookOpen, Package, Eye, ChevronDown, Monitor, MessageSquare, Brain, Zap, Dices, FolderGit2, CalendarClock } from 'lucide-react';
import learn from '../../data/learn.json';
import { useDialog, useScrollLock } from '../lib/useDialog.js';
import { readProgress, saveProgress } from '../lib/learnProgress.js';

// How a picture arrives. Every frame used to settle in the same way, which made
// the thirteenth feel like the first. Assigned per slide in learn.json.
const FRAME_IN = {
  settle: 'learn-frame',
  wipe: 'learn-frame-wipe',
  pan: 'learn-frame-pan',
  emerge: 'learn-frame-emerge',
};

const LEVEL_PILL = {
  Beginner: 'pill-ok',
  Intermediate: 'pill-warn',
  Advanced: 'pill-err',
};

// Reading speed for prose on a screen. 200 wpm is the conservative end of the
// usual 200-250 range, so the estimate errs long rather than short.
const WPM = 200;

const words = (str) => (str ? String(str).trim().split(/\s+/).filter(Boolean).length : 0);

/**
 * Minutes to read a deck, derived from its own text rather than typed into the
 * JSON. The authored numbers had drifted into fiction: `local-llm` claimed the
 * same 20 minutes as a deck with eleven times the words. A number nobody can
 * check is worse than no number, and this one recomputes itself the moment the
 * content changes.
 */
function readMinutes(t) {
  const n = words(t.summary)
    + (t.steps || []).reduce((sum, s) => sum
      + words(s.title) + words(s.body) + words(s.code)
      + (s.checklist || []).reduce((n, c) => n + words(c.label) + words(c.detail), 0)
      + (s.pairs || []).reduce((n, c) => n + words(c.weak) + words(c.better) + words(c.why), 0)
      + (s.timeline || []).reduce((n, c) => n + words(c.when) + words(c.what), 0), 0);
  return Math.max(1, Math.round(n / WPM));
}

// Build the slide list for a tutorial: a cover, one slide per step, a resources
// slide if there's anything to link, then the closing slide. Every deck ends on
// `done`, so finishing one is an event the reader can see rather than a dead end
// at the last piece of content.
function buildSlides(t) {
  const slides = [{ kind: 'cover', title: t.title, summary: t.summary, level: t.level, handsOn: t.handsOn, read: readMinutes(t) }];
  (t.steps || []).forEach((s, i) => slides.push({
    kind: 'step', n: i + 1, total: t.steps.length, section: s.section,
    title: s.title, body: s.body, image: s.image, diagram: s.diagram, demo: s.demo,
    code: s.code, lang: s.lang, expect: s.expect, checklist: s.checklist, pairs: s.pairs,
    timeline: s.timeline, source: s.source, logos: s.logos, animation: s.animation, scene: s.scene, facts: s.facts,
    frame: s.frame, frameAlt: s.frameAlt, frameIn: s.frameIn, reveal: s.reveal, try: s.try,
  }));
  if (t.resources?.length || t.slides) slides.push({ kind: 'resources', title: 'Resources', resources: t.resources || [], slides: t.slides });
  slides.push({ kind: 'done', title: 'Finished' });
  return slides;
}

// What the contents list and the live region call a slide. The step number is
// deliberately left out: the contents row already carries the slide index on its
// left, and several titles start with their own threat number, so including it
// rendered as "3 · 2. · 1 · The API key hiding in your page".
const slideLabel = (s) => (s.kind === 'cover' ? 'Start' : s.title);

/**
 * How much of a deck is actually written. A 4-step outline and a 20-step deck
 * with diagrams, runnable checks and a live demo are not the same object, and
 * the card used to present them identically. Counting what is really there is
 * the only honest signal until the thin decks are filled in.
 */
function depthOf(t) {
  const steps = (t.steps || []).length;
  const extras = (t.steps || []).filter((s) => s.code || s.diagram || s.demo || s.image || s.pairs || s.checklist || s.timeline || s.animation || s.logos || s.scene || s.frame || s.try || s.facts).length;
  return { steps, extras, outline: steps <= 4 && extras <= 1 };
}

export default function Learn() {
  const tutorials = learn.tutorials || [];
  const [activeId, setActiveId] = useState(null);
  const [tag, setTag] = useState('all');
  // Re-read on every close, so a deck finished in the viewer shows as finished
  // on the card behind it without a reload.
  const [progress, setProgress] = useState(readProgress);

  const tags = useMemo(() => {
    const set = new Set();
    tutorials.forEach((t) => (t.tags || []).forEach((x) => set.add(x)));
    return ['all', ...[...set].sort()];
  }, [tutorials]);

  const shown = tag === 'all' ? tutorials : tutorials.filter((t) => (t.tags || []).includes(tag));
  const active = tutorials.find((t) => t.id === activeId) || null;

  // Where to send a reader who finishes a deck: the next one they have not
  // finished, in page order, wrapping round. Null once they have finished
  // everything, and the closing slide then says so instead.
  const nextUnread = (id) => {
    const from = tutorials.findIndex((t) => t.id === id);
    for (let k = 1; k <= tutorials.length; k += 1) {
      const cand = tutorials[(from + k) % tutorials.length];
      if (cand.id !== id && !progress[cand.id]?.done) return cand;
    }
    return null;
  };

  const close = () => { setProgress(readProgress()); setActiveId(null); };

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
            className={`tap-target rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
            const { steps, extras, outline } = depthOf(t);
            const read = readMinutes(t);
            const seen = progress[t.id];
            // Slide 1 is the cover, so "stopped at slide 2" is the first real
            // step. Anything less is not worth offering to resume.
            const resumeAt = !seen?.done && seen?.slide > 1 ? seen.slide : 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className="warm-card card-interactive text-left flex flex-col h-full overflow-hidden"
              >
                {/* The thumbnail runs to the card's edges, so the padding moved
                    off the button and onto the body below it. Decorative: the
                    title underneath already names the deck, and the alt text is
                    there for anyone who wants the picture described. */}
                {t.cover && (
                  <img
                    src={t.cover}
                    alt={t.coverAlt || ''}
                    width={800}
                    height={450}
                    loading="lazy"
                    decoding="async"
                    className="block w-full h-auto border-b border-border"
                    style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
                  />
                )}
                <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`pill ${levelPill}`}>{t.level}</span>
                  {outline && <span className="pill pill-mute">Outline</span>}
                  {seen?.done && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ok">
                      <CheckCircle2 size={12} strokeWidth={2.2} aria-hidden="true" /> Finished
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight leading-snug">{t.title}</h2>
                <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{t.summary}</p>

                {/* What is actually in the deck, counted rather than claimed.
                    The old card said "6 slides" for a four-step outline because
                    it counted the cover and the resources page as content. */}
                <div className="mt-4 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Layers size={11} strokeWidth={2} aria-hidden="true" />
                    <span className="num">{steps}</span> steps
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} strokeWidth={2} aria-hidden="true" />
                    <span className="num">{read}</span> min read
                  </span>
                  {t.handsOn && (
                    <span className="inline-flex items-center gap-1">
                      <Wrench size={11} strokeWidth={2} aria-hidden="true" />
                      <span className="num">{t.handsOn}</span> min hands-on
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">
                    {extras > 0
                      ? <><span className="num">{extras}</span> with code or a demo</>
                      : 'Text only'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    {resumeAt
                      ? <><RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" /> Resume</>
                      : <><Play size={13} strokeWidth={2.5} aria-hidden="true" /> {seen?.done ? 'Read again' : 'Start'}</>}
                  </span>
                </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <SlideViewer
          key={active.id}
          tutorial={active}
          startAt={progress[active.id]?.done ? 0 : (progress[active.id]?.slide || 0)}
          next={nextUnread(active.id)}
          onJump={(t) => { setProgress(readProgress()); setActiveId(t.id); }}
          onClose={close}
        />
      )}
    </div>
  );
}

function SlideViewer({ tutorial, startAt = 0, next = null, onJump, onClose }) {
  const slides = useMemo(() => buildSlides(tutorial), [tutorial]);
  const total = slides.length;
  const [i, setI] = useState(() => Math.min(Math.max(0, startAt), total - 1));
  const [copied, setCopied] = useState(false);
  const [edge, setEdge] = useState(null); // 'left' | 'right' | null: which nav circle to reveal
  const [contents, setContents] = useState(false);
  // How much of the current slide is showing. A slide arrives as its label,
  // picture and sentence; its working visual waits for another press. Reading
  // and watching at the same time means doing neither, and the old build played
  // a four-second animation under a paragraph nobody had finished.
  const [beat, setBeat] = useState(0);
  const EDGE = 0.25; // fraction of width near each side that navigates + reveals the circle

  const beatsOn = (sl) => (sl?.kind === 'step'
    && (sl.diagram || sl.demo || sl.animation || sl.scene || sl.pairs || sl.checklist || sl.timeline || sl.code || sl.try)
    ? 2 : 1);

  // Next reveals the rest of this slide before it leaves it; Back collapses it
  // again, so the two directions stay symmetrical.
  const go = (d) => {
    const here = slides[i];
    if (d > 0 && beat < beatsOn(here) - 1) { setBeat((b) => b + 1); return; }
    if (d < 0 && beat > 0) { setBeat((b) => b - 1); return; }
    setI((x) => {
      const next = Math.min(total - 1, Math.max(0, x + d));
      if (next !== x) setBeat(0);
      return next;
    });
  };

  // Escape, focus moved in on open and returned to the card on close, and Tab
  // kept inside the panel. This viewer bound Escape by hand and stopped there,
  // which left the whole Learn index tabbable behind a full-screen overlay.
  const panelRef = useDialog(onClose);
  useScrollLock();

  const titleId = `learn-deck-${tutorial.id}`;
  const scrollerRef = useRef(null);

  useEffect(() => { setCopied(false); setContents(false); setBeat(0); }, [i]);

  // The revealed block stays mounted for a moment after it is collapsed, so the
  // height has something to animate down to. It is torn down on a slide change
  // either way, so nothing keeps running in the background.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (beat >= 1) { setHeld(true); return undefined; }
    const t = setTimeout(() => setHeld(false), 950);
    return () => clearTimeout(t);
  }, [beat, i]);

  // A new slide is a new page of content, so start it at the top rather than
  // wherever the previous one was scrolled to.
  useEffect(() => { scrollerRef.current?.scrollTo({ top: 0 }); }, [i]);

  // Furthest slide reached, and whether the closing slide was ever seen.
  useEffect(() => { saveProgress(tutorial.id, i + 1, i === total - 1); }, [i, tutorial.id, total]);

  // `go` reads `beat` and `i`, so the listener has to see the current one. The
  // effect runs once, so a directly captured `go` goes stale immediately: the
  // arrow keys then skipped the reveal and jumped straight to the next slide,
  // while the on-screen button, called from the live render, behaved correctly.
  // Same ref trick useDialog uses for onClose, and for the same reason.
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goRef.current(1);
      else if (e.key === 'ArrowLeft') goRef.current(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  // Click near the left edge to go back, near the right edge to advance.
  // The middle is left alone so reading and text selection still work, and
  // clicks on buttons, links, code blocks or an interactive demo never trigger
  // navigation. `[data-interactive]` is the demo's opt-out: its card starts
  // 68px inside the left click zone, so without it clicking the demo's own
  // padding threw the reader back a slide mid-experiment.
  function onSlideClick(e) {
    if (e.target.closest('button, a, input, textarea, select, pre, [data-interactive]')) return;
    if (window.getSelection && window.getSelection().toString()) return;
    const el = e.currentTarget;
    const f = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth;
    if (f < EDGE) go(-1);
    else if (f > 1 - EDGE) go(1);
  }

  // Reveal a side's circle only once the pointer moves within EDGE of that edge,
  // not on general hover. Clears as the pointer returns to the middle or leaves.
  function onSlideMove(e) {
    if (e.target.closest('[data-interactive]')) { setEdge(null); return; }
    const el = e.currentTarget;
    const f = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth;
    setEdge(f < EDGE ? 'left' : f > 1 - EDGE ? 'right' : null);
  }

  const s = slides[i];
  const pct = total > 1 ? ((i + 1) / total) * 100 : 100;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-background flex flex-col"
    >
      {/* Top bar. The slide number used to live here as "5 / 22" while the slide
          itself said "STEP 4 OF 20", two numbering systems disagreeing on one
          screen. Position is now the progress bar's job and the count belongs to
          the step label alone. */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 border-b border-border">
        <h2 id={titleId} className="text-xs font-medium text-muted truncate">{tutorial.title}</h2>
        <button
          onClick={onClose}
          className="tap-target grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close this deck"
        ><X size={18} /></button>
      </div>
      <div
        className="flex-shrink-0 h-0.5 bg-border"
        role="progressbar"
        aria-valuenow={i + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Deck progress"
      >
        <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      {/* Arrow keys replace everything on screen and used to announce nothing.
          Polite, so it waits for a screen reader to finish the current phrase
          rather than cutting across it. */}
      <p aria-live="polite" className="sr-only">
        Slide {i + 1} of {total}. {slideLabel(s)}.
      </p>

      {/* Slide area: the scroll container and the edge circles both live here,
          and overflow-hidden clips them to this band so nothing ever overlaps
          the top bar above or the controls below. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        ref={scrollerRef}
        className="no-scrollbar absolute inset-0 overflow-y-auto flex px-6 sm:px-10 py-8"
        onClick={onSlideClick}
        onMouseMove={onSlideMove}
        onMouseLeave={() => setEdge(null)}
      >
        {/* Keyed on the slide index so React remounts the subtree, which is what
            restarts the CSS animation. Without the key the content swaps in
            place and the deck reads as a jump-cut. */}
        {/* Two elements, not one. `learn-in` ends on a transform keyframe with
            `both` fill, and a filled animation beats a transition on the same
            property, so a lift declared on this element would never apply. The
            entrance stays here; the rise gets its own wrapper inside. */}
        <div key={i} className="learn-in m-auto w-full max-w-4xl">
        <div className={`learn-lift ${beat >= 1 ? 'is-lifted' : ''}`}>
          {s.kind === 'cover' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                <span className={`pill ${LEVEL_PILL[s.level] || 'pill-mute'}`}>{s.level}</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted"><Clock size={12} aria-hidden="true" /> {s.read} min read</span>
                {s.handsOn && <span className="inline-flex items-center gap-1 text-xs text-muted"><Wrench size={12} aria-hidden="true" /> {s.handsOn} min hands-on</span>}
              </div>
              <h3 className="text-3xl sm:text-5xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-4 text-lg text-muted leading-relaxed max-w-xl mx-auto">{s.summary}</p>
              {tutorial.logos && <div className="mt-7 flex justify-center"><LogoRow ids={tutorial.logos} /></div>}
              <button onClick={() => go(1)} className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]">
                Start <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          )}

          {s.kind === 'step' && (
            <div className="learn-stagger">
              {/* Marks sit above the step label, in the same place on every
                  slide that has them. They used to float between paragraphs,
                  which read as an interruption rather than a header. */}
              {s.logos && (
                <div className="mb-4 flex items-center gap-4 flex-wrap">
                  <LogoRow ids={s.logos} />
                </div>
              )}
              <div className="h-section">Step {s.n} of {s.total}</div>
              <h3 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight max-w-3xl">{s.title}</h3>

              {/* The establishing shot: what this moment looked like, before the
                  argument and before the mechanism. Full column width, because a
                  film still shrunk to the width of a diagram stops being one.
                  Decorative only where a diagram carries the same information,
                  so the alt text is supplied per step and empty when the step's
                  own visual already says it. */}
              {s.frame && (
                <figure className="mt-5 mb-1 overflow-hidden rounded-xl border border-border bg-accent">
                  <img
                    src={s.frame}
                    alt={s.frameAlt || ''}
                    width={1400}
                    height={787}
                    loading="lazy"
                    decoding="async"
                    className={`${FRAME_IN[s.frameIn] || 'learn-frame'} block w-full h-auto`}
                    style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
                  />
                </figure>
              )}

              <p className="mt-4 text-lg text-muted leading-relaxed max-w-3xl">{s.reveal === 'words' ? byWord(s.body) : emphasise(s.body)}</p>

              {s.facts && <div className="mt-7"><Facts rows={s.facts} /></div>}
              {/* Visual: a real screenshot if one is supplied, otherwise the
                  built-in diagram for this step. Drop an image path into the
                  step's `image` field later to replace the diagram. */}
              {s.image ? (
                <img src={s.image} alt="" className="mt-6 w-full max-w-xl rounded-xl border border-border" />
              ) : s.diagram ? (
                <div className="mt-6"><StepDiagram kind={s.diagram} /></div>
              ) : null}

              {/* Everything below waits for a press. Mounting on reveal is also
                  what makes a scene start its animation then, rather than four
                  seconds before the reader looks at it. */}
              <div className={`learn-grow ${beat >= 1 ? 'is-open' : ''}`}>
                <div className="learn-grow-inner">
                {(beat >= 1 || held) && (
                <div>
                  {s.animation === 'breakout' && <div className="mt-6"><Breakout /></div>}

                  {s.scene && <div className="mt-6"><Scene kind={s.scene} /></div>}

                  {s.try && <div className="mt-6"><TryIt kind={s.try} /></div>}

                  {s.demo === 'xss' && <div className="mt-6"><XssDemo /></div>}
                  {s.demo === 'idor' && <div className="mt-6"><IdorDemo /></div>}
                  {s.demo === 'prompt' && <div className="mt-6"><PromptDemo /></div>}

                  {s.pairs && (
                    <div className="mt-6 space-y-4">
                      {s.pairs.map((pair, n) => <BeforeAfter key={n} {...pair} />)}
                    </div>
                  )}

                  {s.checklist && <div className="mt-6"><Checklist items={s.checklist} /></div>}

                  {s.timeline && <div className="mt-6"><Timeline rows={s.timeline} /></div>}

              {s.source && (
                <p className="mt-6 text-xs text-muted">
                  <BookOpen size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1.5" aria-hidden="true" />
                  Source:{' '}
                  <a href={s.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    {s.source.label}
                  </a>
                </p>
              )}

                  {s.code && (
                    <CodeBlock
                      code={s.code}
                      lang={s.lang}
                      expect={s.expect}
                      copied={copied}
                      onCopy={() => copyCode(s.code)}
                    />
                  )}
                </div>
                )}
                </div>
              </div>
            </div>
          )}

          {s.kind === 'resources' && (
            <div className="text-center">
              <div className="h-section">Keep going</div>
              <h3 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight">Resources</h3>
              <div className="mt-6 flex flex-col gap-2 max-w-md mx-auto text-left">
                {s.slides && (
                  <a href={s.slides} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-pill px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                    <span className="inline-flex items-center gap-2"><Presentation size={15} aria-hidden="true" /> Full slide deck</span>
                    <ExternalLink size={14} className="text-muted" aria-hidden="true" />
                  </a>
                )}
                {s.resources.map((r) => (
                  <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-pill px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                    <span>{r.label}</span>
                    <ExternalLink size={14} className="text-muted" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Every deck used to stop dead on its last piece of content: no
              acknowledgement, no way back to Learn, nothing to read next. */}
          {s.kind === 'done' && (
            <div className="text-center">
              <CheckCircle2 size={40} strokeWidth={1.5} className="mx-auto text-ok" aria-hidden="true" />
              <h3 className="mt-4 text-2xl sm:text-4xl font-semibold tracking-tight">That&apos;s the deck</h3>
              <p className="mt-3 text-lg text-muted leading-relaxed max-w-xl mx-auto">
                {tutorial.title} is marked as finished on your Learn page. It stays there on this browser only.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                {next ? (
                  <button onClick={() => onJump?.(next)} className="btn btn-primary">
                    Next: {next.title}
                    <ChevronRight size={15} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                ) : (
                  <p className="text-sm text-muted">You have finished every deck on the page.</p>
                )}
                <button onClick={onClose} className="btn btn-ghost">Back to Learn</button>
              </div>
              <button
                onClick={() => setI(0)}
                className="tap-target mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" /> Read it again
              </button>
            </div>
          )}
        </div>
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

      {/* Controls. The 22 pagination dots that used to sit here measured 24x6px,
          under the 24x24 minimum target size, and nobody can aim at the eleventh
          of twenty-two identical dots anyway. Position is the progress bar's
          job; jumping is the contents list's. */}
      <div className="relative flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 border-t border-border">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="tap-target grid place-items-center w-10 h-10 rounded-full border border-border bg-background text-foreground transition disabled:opacity-30 enabled:hover:bg-accent"
          aria-label="Previous slide"
        ><ChevronLeft size={18} /></button>

        <button
          onClick={() => setContents((c) => !c)}
          aria-expanded={contents}
          aria-controls={`learn-contents-${tutorial.id}`}
          className="tap-target inline-flex items-center gap-2 rounded-full border border-border bg-pill px-3.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          <List size={14} strokeWidth={2} aria-hidden="true" />
          <span className="num">{i + 1}</span>
          <span className="text-muted">of</span>
          <span className="num">{total}</span>
        </button>

        {/* Two jobs, so two icons. A down chevron means there is more of this
            slide; a right chevron means the slide is finished. Without the
            distinction, Next behaves unpredictably. */}
        <button
          onClick={() => go(1)}
          disabled={i === total - 1 && beat >= beatsOn(s) - 1}
          className={`tap-target grid place-items-center w-10 h-10 rounded-full border transition disabled:opacity-30 ${
            beat < beatsOn(s) - 1
              ? 'border-foreground bg-foreground text-background enabled:hover:opacity-90'
              : 'border-border bg-background text-foreground enabled:hover:bg-accent'
          }`}
          aria-label={beat < beatsOn(s) - 1 ? 'Show the rest of this slide' : 'Next slide'}
        >
          {beat < beatsOn(s) - 1
            ? <ChevronDown size={18} className="learn-nudge" />
            : <ChevronRight size={18} />}
        </button>

        {contents && (
          <div
            id={`learn-contents-${tutorial.id}`}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[min(26rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-[var(--popover-shadow)]"
            style={{ scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}
          >
            {/* Grouped by the step's `section`, so a 23-slide deck with a clean
                five-part structure can be navigated by part instead of by
                scrolling a flat list of twenty-three near-identical titles. */}
            <ol>
              {slides.map((sl, idx) => {
                const heading = sl.section && sl.section !== slides[idx - 1]?.section;
                return (
                  <li key={idx}>
                    {heading && (
                      <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
                        {sl.section}
                      </p>
                    )}
                    <button
                      // Closes here, not only in the effect keyed on the slide
                      // index: picking the slide you are already on does not
                      // change that index, so the panel stayed open on top of
                      // the slide it had just taken you to.
                      onClick={() => { setI(idx); setBeat(0); setContents(false); }}
                      aria-current={idx === i ? 'true' : undefined}
                      className={`tap-target w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                        idx === i ? 'bg-foreground text-background' : 'hover:bg-accent'
                      }`}
                    >
                      <span className={`num w-5 flex-shrink-0 text-right ${idx === i ? '' : 'text-muted'}`}>{idx + 1}</span>
                      <span className="truncate">{slideLabel(sl)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* --------------------------------------------------------------------------
   Code blocks, checklists and before/after pairs.
   -------------------------------------------------------------------------- */

// Comment and string colouring only, hand-rolled. A real highlighter is 100KB+
// for four decks of mostly-comment snippets, and the comments ARE the teaching
// here. Everything is built as React nodes, never innerHTML, so a code sample
// can never execute on a page that is teaching people about XSS.
const COMMENT = { sh: /#/, bash: /#/, js: /\/\//, jsx: /\/\//, ts: /\/\//, py: /#/, sql: /--/, http: /#/ };

function highlight(code, lang) {
  const marker = COMMENT[lang] || COMMENT.js;
  return code.split('\n').map((line, n) => {
    const m = line.match(marker);
    const at = m ? m.index : -1;
    if (at === -1) return <span key={n}>{line || ' '}{'\n'}</span>;
    return (
      <span key={n}>
        {line.slice(0, at)}
        <span className="text-muted">{line.slice(at)}</span>
        {'\n'}
      </span>
    );
  });
}

// What the three-digit numbers mean, in words a reader who has never seen one
// can use. They are the whole vocabulary of the "test it" steps, and the deck
// used to print them bare: a slide said "/.env returns 404" and left it there.
// Only the codes a given block actually mentions are shown, so this stays a
// short line rather than a reference table nobody reads.
const STATUS_MEANING = {
  200: 'the server said yes and sent it',
  401: 'you are not signed in',
  403: 'signed in, but not allowed this one',
  404: 'there is nothing here',
  413: 'what you sent is too big',
  429: 'too many tries, slow down',
  500: 'the server broke',
};

const codesIn = (...texts) => {
  const seen = new Set();
  for (const t of texts) {
    for (const m of String(t || '').matchAll(/\b(200|401|403|404|413|429|500)\b/g)) seen.add(m[1]);
  }
  return [...seen].sort();
};

/** The numbers used just above, each with its plain meaning. */
function StatusKey({ codes }) {
  if (!codes.length) return null;
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted">
      <span className="font-semibold text-foreground">The numbers mean:</span>
      {codes.map((c) => (
        <span key={c}>
          <span className="num font-semibold text-foreground">{c}</span>
          {' '}
          {STATUS_MEANING[c]}
        </span>
      ))}
    </p>
  );
}

const LANG_LABEL = { sh: 'Terminal', bash: 'Terminal', js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', py: 'Python', sql: 'SQL', http: 'Request' };

/**
 * A code sample with the language named and, where it matters, what a pass and
 * a fail actually look like.
 *
 * The deck used to ship shell and JavaScript in identical grey boxes with no
 * label, and the "test it" slides told a beginner to run something without ever
 * saying how to read the result.
 */
function CodeBlock({ code, lang, expect, copied, onCopy }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 rounded-t-xl border border-b-0 border-border bg-pill px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
          {(lang === 'sh' || lang === 'bash') ? <Terminal size={11} strokeWidth={2.2} aria-hidden="true" /> : <FileCode size={11} strokeWidth={2.2} aria-hidden="true" />}
          {LANG_LABEL[lang] || 'Code'}
        </span>
        <button
          onClick={onCopy}
          className="tap-target grid place-items-center w-7 h-7 rounded-lg text-muted hover:text-foreground transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} strokeWidth={2.5} className="text-ok" /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="rounded-b-xl bg-accent border border-border p-4 text-sm num overflow-x-auto whitespace-pre"><code>{highlight(code, lang)}</code></pre>

      {expect && (
        <div className="mt-3">
          {/* The two panels used to appear with no framing at all, so it was
              not clear whether they described what the command does, what you
              might see, or what you are hoping for. */}
          <div className="h-section">What you should see when you run this</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {expect.pass && (
            <p className="flex items-start gap-1.5 rounded-lg border border-ok/40 bg-background px-3 py-2 text-xs">
              <ShieldCheck size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-ok" aria-hidden="true" />
              <span><span className="font-semibold">Safe. </span><span className="text-muted">{expect.pass}</span></span>
            </p>
          )}
          {expect.fail && (
            <p className="flex items-start gap-1.5 rounded-lg border border-err/40 bg-background px-3 py-2 text-xs">
              <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-err" aria-hidden="true" />
              <span><span className="font-semibold">Exposed. </span><span className="text-muted">{expect.fail}</span></span>
            </p>
          )}
          </div>
          <StatusKey codes={codesIn(expect.pass, expect.fail, code)} />
        </div>
      )}
    </div>
  );
}

/**
 * A list you can actually tick. The deck's closing checks were written twice, as
 * two run-on paragraphs, which is the one thing on the page a reader was meant
 * to take away and act on.
 */
function Checklist({ items }) {
  // Reads, does not ask. This was a tickable list with a "0 of 5 checked"
  // counter, which turned a piece of reading into an unfinished task and put a
  // nagging zero under four slides that were never to-do lists.
  return (
    <ol className="rounded-xl border border-border bg-pill p-4 space-y-2.5">
      {items.map((it, n) => (
        <li key={n} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-fg"
            style={{ background: 'var(--foreground)' }}
          />
          <span className="min-w-0">
            <span className="text-sm font-medium">{it.label}</span>
            {it.detail && <span className="block text-xs text-muted leading-relaxed">{it.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Paints in the load-bearing words after the sentence has landed.
 *
 * `**phrase**` in the JSON marks a highlight; `~~figure~~` marks a number, which
 * gets a quieter lift and never an opacity fade, because fading a word in leaves
 * a hole in the middle of a paragraph.
 *
 * Built as React nodes, never innerHTML: this deck sits next to one about what
 * happens when a server renders text a stranger supplied.
 */
/** Word by word, for the few slides that earn it. */
function byWord(text) {
  if (!text) return text;
  return String(text).replace(/\*\*|~~/g, '').split(/(\s+)/).map((w, k) => (
    /^\s+$/.test(w)
      ? <Fragment key={k}>{w}</Fragment>
      : <span key={k} className="learn-word" style={{ animationDelay: `${260 + k * 45}ms` }}>{w}</span>
  ));
}

function emphasise(text) {
  if (!text) return text;
  const parts = String(text).split(/(\*\*[^*]+\*\*|~~[^~]+~~)/g);
  let n = 0;
  return parts.map((part, k) => {
    const strong = /^\*\*[^*]+\*\*$/.test(part);
    const soft = /^~~[^~]+~~$/.test(part);
    if (!strong && !soft) return <Fragment key={k}>{part}</Fragment>;
    n += 1;
    const delay = `${340 + n * 170}ms`;
    return strong
      ? <mark key={k} className="learn-mark" style={{ animationDelay: delay }}>{part.slice(2, -2)}</mark>
      : <span key={k} className="learn-pop num font-semibold text-foreground" style={{ animationDelay: delay }}>{part.slice(2, -2)}</span>;
  });
}

/** Steps a counter 0..n-1 on a timer, and hands back a replay control. */
function useStages(count, step = 850, delay = 400) {
  const still = prefersReducedMotion();
  const [stage, setStage] = useState(still ? count - 1 : -1);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (still) return undefined;
    setStage(-1);
    const timers = Array.from({ length: count }, (_, n) => setTimeout(() => setStage(n), delay + n * step));
    return () => timers.forEach(clearTimeout);
  }, [run, count, step, delay, still]);
  return [stage, () => setRun((r) => r + 1)];
}

function SceneShell({ title, caption, onReplay, children }) {
  return (
    <div data-interactive className="rounded-xl border border-border bg-pill p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="h-section">{title}</div>
        <button
          onClick={onReplay}
          className="tap-target inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
        >
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
          Play again
        </button>
      </div>
      <div className="mt-4">{children}</div>
      {caption && (
        <p aria-live="polite" className="mt-3 border-t border-border pt-3 text-xs text-muted leading-relaxed">{caption}</p>
      )}
    </div>
  );
}

const fade = (on, shift = 8) => ({
  opacity: on ? 1 : 0,
  transform: on ? 'none' : `translateY(${shift}px)`,
  transition: 'opacity 520ms ease, transform 520ms cubic-bezier(0.2,0.9,0.3,1)',
});

/**
 * The animated illustrations. Each is a picture of the single idea its slide
 * turns on, played in stages, because "the marker did read the working" and
 * "four days with nobody driving" are both things you understand faster by
 * watching them happen than by reading a sentence about them.
 */
function Scene({ kind }) {
  if (kind === 'exam') return <SceneExam />;
  if (kind === 'noticeboard') return <SceneNoticeboard />;
  if (kind === 'ledger') return <SceneLedger />;
  if (kind === 'watch') return <SceneWatch />;
  return null;
}

/* --------------------------------------------------------------------------
   Try it yourself.

   Everything else in this deck is watched. These are pressed. Reading that an
   agent "found the one service that could call out" is not the same as clicking
   four plausible ways out of a room and discovering which one opens, and the
   deck's own best moment, the XSS demo two decks over, works precisely because
   the reader does the thing rather than watching it.

   All four are simulations. Nothing is fetched, nothing executes, and no real
   address or payload is reachable from here.
   -------------------------------------------------------------------------- */

function TryIt({ kind }) {
  if (kind === 'guesses') return <TryGuesses />;
  if (kind === 'loop') return <TryLoop />;
  if (kind === 'fit') return <TryFit />;
  if (kind === 'diff') return <TryDiff />;
  if (kind === 'escape') return <TryEscape />;
  if (kind === 'scorer') return <TryScorer />;
  if (kind === 'board') return <TryBoard />;
  if (kind === 'inject') return <TryInject />;
  if (kind === 'agent') return <TryAgent />;
  return null;
}

function TryShell({ title, lede, children, result, onReset }) {
  return (
    <div data-interactive className="rounded-xl border border-border bg-pill p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="h-section">{title}</div>
        {onReset && (
          <button
            onClick={onReset}
            className="tap-target inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
          >
            <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
            Start over
          </button>
        )}
      </div>
      {lede && <p className="mt-2 text-sm text-muted leading-relaxed">{lede}</p>}
      <div className="mt-4">{children}</div>
      <p aria-live="polite" className="mt-3 border-t border-border pt-3 text-xs leading-relaxed">
        {result}
      </p>
    </div>
  );
}

const tryBtn = (on) => `tap-target rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
  on ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border hover:bg-accent'
}`;

/**
 * The gaps in a four-word request, opened one at a time.
 *
 * "It lacks context" is a sentence people nod at and do not act on. Pressing
 * four blanks and watching each one turn into three equally reasonable readings
 * is the same claim, except it arrives as a count: eighty-one versions of the
 * thing you asked for, and you wanted one of them.
 *
 * Every pick is authored, not random. A random choice here would re-roll on
 * each render, and the reader would think the demo was broken rather than that
 * the ambiguity was the point.
 */
const GAPS = [
  {
    key: 'format',
    label: 'Format',
    question: 'What shape comes back?',
    readings: ['A bulleted changelog', 'Two paragraphs of prose', 'A markdown table'],
    picked: 1,
  },
  {
    key: 'length',
    label: 'Length',
    question: 'How long is it?',
    readings: ['Three lines', 'Half a page', 'Everything in the diff'],
    picked: 2,
  },
  {
    key: 'audience',
    label: 'Audience',
    question: 'Who reads it?',
    readings: ['Your team', 'Customers', 'A recruiter looking at the repo'],
    picked: 0,
  },
  {
    key: 'tone',
    label: 'Tone',
    question: 'How does it sound?',
    readings: ['Flat and factual', 'Upbeat launch copy', 'Formal release language'],
    picked: 1,
  },
];

function TryGuesses() {
  const [open, setOpen] = useState(() => new Set());
  const all = open.size === GAPS.length;

  return (
    <TryShell
      title="Four words, four blanks"
      lede="This is the whole request. Press each blank to see what had to be decided for you."
      onReset={open.size ? () => setOpen(new Set()) : null}
      result={all
        ? 'Four blanks, three readings each. That is 81 versions of the thing you asked for, and one of them is the one you wanted.'
        : open.size === 0
          ? 'Nothing here is a trick question. Every reading below is a reasonable way to read the same sentence.'
          : `${open.size} of 4 opened. None of these choices was reported back to you.`}
    >
      <pre className="rounded-lg border border-border bg-background p-3 text-xs num">Write release notes for this PR.</pre>

      <div className="mt-3 flex flex-wrap gap-2">
        {GAPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setOpen((prev) => {
              const next = new Set(prev);
              if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
              return next;
            })}
            aria-expanded={open.has(g.key)}
            className={tryBtn(open.has(g.key))}
          >
            {open.has(g.key) ? <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1" aria-hidden="true" /> : null}
            {g.label}
          </button>
        ))}
      </div>

      {open.size > 0 && (
        <div className="mt-3 space-y-2">
          {GAPS.filter((g) => open.has(g.key)).map((g) => (
            <div key={g.key} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Dices size={13} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden="true" />
                {g.question}
              </div>
              <ul className="mt-2 space-y-1">
                {g.readings.map((r, n) => (
                  <li key={r} className={`flex items-center gap-2 text-xs ${n === g.picked ? 'text-foreground font-medium' : 'text-muted'}`}>
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${n === g.picked ? 'bg-ok' : 'bg-border'}`}
                    />
                    <span>{r}</span>
                    {n === g.picked && <span className="ml-auto text-[10px] text-muted">what it went with</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </TryShell>
  );
}

/**
 * One agent turn at a time, with a label on every line saying who produced it.
 *
 * The agent-loop diagram two slides up shows the cycle; this shows the artefact
 * the cycle actually leaves behind, which is a `messages` array that grows by
 * two entries per pass. The alternating authorship is the lesson: the model
 * never runs the tool, it asks, and the line that runs it is yours.
 */
const TURNS = [
  { who: 'you', label: 'you', text: 'What should I wear in Copenhagen?', note: 'role: user' },
  { who: 'model', label: 'the model', text: 'get_weather({ city: "Copenhagen" })', note: 'stop_reason: tool_use · it asked, nothing ran' },
  { who: 'code', label: 'your code', text: '4C, rain', note: 'tool_result · your function ran, not the model' },
  { who: 'model', label: 'the model', text: 'Take a waterproof jacket. It is 4C and raining.', note: 'stop_reason: end_turn · the loop exits here' },
];

function TryLoop() {
  const [shown, setShown] = useState(1);
  const done = shown >= TURNS.length;

  return (
    <TryShell
      title="One turn at a time"
      lede="This is the whole conversation an agent has. Step through it and watch who produces each line."
      onReset={shown > 1 ? () => setShown(1) : null}
      result={done
        ? 'Two of those four lines are yours. The model asked for the weather and read the answer; it never called anything.'
        : `Turn ${shown} of ${TURNS.length}. Every turn resends the whole list above, which is why a long agent run costs more each pass.`}
    >
      <ol className="space-y-2">
        {TURNS.slice(0, shown).map((t, n) => (
          <li
            key={t.text}
            className={`rounded-lg border bg-background p-3 ${t.who === 'model' ? 'border-border' : 'border-ok/50'}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              {t.who === 'model'
                ? <Bot size={13} strokeWidth={2} className="flex-shrink-0" aria-hidden="true" />
                : <Terminal size={13} strokeWidth={2} className="flex-shrink-0 text-ok" aria-hidden="true" />}
              <span className={t.who === 'model' ? '' : 'text-ok'}>{t.label}</span>
              <span className="ml-auto num text-[10px] text-muted">{n + 1}</span>
            </div>
            <p className="mt-1 num text-xs">{t.text}</p>
            <p className="mt-1 text-[10px] text-muted">{t.note}</p>
          </li>
        ))}
      </ol>

      {!done && (
        <button onClick={() => setShown((s) => s + 1)} className={`mt-3 ${tryBtn(false)}`}>
          <Play size={12} strokeWidth={2.2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
          Run the next turn
        </button>
      )}
    </TryShell>
  );
}

/**
 * Does it fit, and what happens when it does not.
 *
 * The deck's own claim is that a model one size too big does not refuse, it
 * crawls, and that this is what people mean when they say local models are
 * useless. A table of hardware tiers states that; picking your own memory and
 * watching the row that spills say "still answers, about a word a second" is
 * the same fact arriving as a consequence.
 *
 * The numbers are computed from the rule of thumb rather than typed, so the
 * block cannot drift from the slide that teaches the rule: at Q4 a model needs
 * roughly half its parameter count in GB, plus about 15% overhead.
 */
const RAM_OPTIONS = [8, 16, 32, 64];
const MODEL_SIZES = [3, 8, 14, 32, 70];
const needGb = (b) => (b / 2) * 1.15;
// The OS, the browser and everything else you have open. A machine with 8GB
// does not have 8GB for a model, which is the part the tier tables leave out.
const usableGb = (ram) => ram - (ram <= 8 ? 3 : 4);

function TryFit() {
  const [ram, setRam] = useState(null);
  const free = ram ? usableGb(ram) : 0;
  const fits = ram ? MODEL_SIZES.filter((b) => needGb(b) <= free) : [];
  const biggest = fits[fits.length - 1];

  return (
    <TryShell
      title="Will it fit?"
      lede="Pick the memory in the machine you actually have. VRAM if you have a dedicated GPU, otherwise system RAM."
      onReset={ram ? () => setRam(null) : null}
      result={ram
        ? biggest
          ? `${free} GB free after the operating system takes its share, so ${biggest}B is your ceiling. The row below it is the one to start with.`
          : 'Nothing on this list fits comfortably. A 1B model will still run, and a browser with forty tabs open is competing with it.'
        : 'Same model, same question, two machines: one answers as fast as you read, the other takes a minute. The difference is this number.'}
    >
      <div className="flex flex-wrap gap-2">
        {RAM_OPTIONS.map((r) => (
          <button key={r} onClick={() => setRam(r)} aria-pressed={ram === r} className={tryBtn(ram === r)}>
            {r} GB
          </button>
        ))}
      </div>

      {ram && (
        <div className="mt-3 space-y-1.5">
          {MODEL_SIZES.map((b) => {
            const need = needGb(b);
            const ok = need <= free;
            // Spilling onto disk keeps working up to roughly this much over,
            // which is the row the deck cares about: it answers, just slowly.
            // Past it the thing is not a slow model, it is not a model.
            const close = !ok && need <= free * 2.5;
            return (
              <div
                key={b}
                className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-2 ${ok ? 'border-ok/50' : 'border-border'}`}
              >
                <MemoryStick size={14} strokeWidth={1.75} className={`flex-shrink-0 ${ok ? 'text-ok' : 'text-muted'}`} aria-hidden="true" />
                <span className="num text-xs font-medium w-10">{b}B</span>
                <span className="num text-[11px] text-muted w-16">{need.toFixed(1)} GB</span>
                <span className={`text-xs ${ok ? '' : 'text-muted'}`}>
                  {ok ? 'fits in memory' : close ? 'still answers, about a word a second' : 'will not load usefully'}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-muted leading-relaxed">
            At Q4, a model needs roughly half its parameter count in GB plus about 15%. Nothing here refuses to run: the rows that do not fit spill onto the disk and keep going, slowly.
          </p>
        </div>
      )}
    </TryShell>
  );
}

/**
 * Five changed files after a one-sentence request, three of which are not what
 * was asked for.
 *
 * "Read the diff" is advice everyone agrees with and nobody can act on until
 * they know what they are looking for. The three surprises here are the three
 * the slide names: a file you did not ask for, a dependency you did not ask
 * for, and a test that cannot fail.
 */
const DIFF_FILES = [
  { path: 'src/components/SignupForm.tsx', delta: '+48', ok: true, why: 'What you asked for. Read it, but it is not a surprise.' },
  { path: 'src/App.tsx', delta: '+2', ok: true, why: 'The form had to be wired in somewhere. Two lines, and the feature is reachable because of them.' },
  { path: 'package.json', delta: '+1', ok: false, why: 'A form library you never mentioned. Now it is a dependency, in the lockfile and in the bundle.' },
  { path: 'src/lib/analytics.ts', delta: '+12', ok: false, why: 'A new file outside the one component you named. Nothing asked for this.' },
  { path: 'src/components/SignupForm.test.tsx', delta: '+9', ok: false, why: 'A test whose only assertion passes whatever the form does. It will never go red.' },
];

function TryDiff() {
  const [seen, setSeen] = useState(() => new Set());
  const all = seen.size === DIFF_FILES.length;
  const surprises = DIFF_FILES.filter((f) => !f.ok).length;

  return (
    <TryShell
      title="Five files changed"
      lede="You asked for one thing: a form with an email field, and only touch the form component. Press each file."
      onReset={seen.size ? () => setSeen(new Set()) : null}
      result={all
        ? `${surprises} of the 5 are not what you asked for. None of them would have shown up in a summary that said "added the signup form".`
        : seen.size === 0
          ? 'The summary said "added the signup form, all tests passing", and that was true.'
          : `${seen.size} of 5 opened.`}
    >
      <ul className="space-y-1.5">
        {DIFF_FILES.map((f) => (
          <li key={f.path}>
            <button
              onClick={() => setSeen((prev) => new Set(prev).add(f.path))}
              aria-expanded={seen.has(f.path)}
              className={`tap-target w-full rounded-lg border bg-background px-3 py-2 text-left transition-colors ${
                seen.has(f.path) ? (f.ok ? 'border-ok/50' : 'border-err/40') : 'border-border hover:bg-accent'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileCode size={13} strokeWidth={1.75} className="flex-shrink-0 text-muted" aria-hidden="true" />
                <span className="num text-xs truncate">{f.path}</span>
                <span className="num ml-auto text-[11px] text-muted">{f.delta}</span>
              </span>
              {seen.has(f.path) && (
                <span className={`mt-1.5 block text-[11px] leading-relaxed ${f.ok ? 'text-muted' : 'text-foreground'}`}>
                  {f.ok ? 'Expected. ' : 'Not asked for. '}
                  <span className="text-muted">{f.why}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </TryShell>
  );
}

/** Four plausible ways out of a sealed room. One of them is not sealed. */
function TryEscape() {
  const ways = [
    { key: 'page', label: 'Open a web page', ok: false, why: 'Blocked. The room has no route to the open internet.' },
    { key: 'dns', label: 'Look up an address', ok: false, why: 'Blocked. Name lookups go nowhere.' },
    { key: 'file', label: 'Write a file somewhere else', ok: false, why: 'Blocked. The disk stops at the edge of the room.' },
    { key: 'pkg', label: 'Install a software library', ok: true, why: 'This one works. The package service fetches it from outside, so something in here can reach out after all.' },
  ];
  const [tried, setTried] = useState([]);
  const found = tried.includes('pkg');
  const last = ways.find((w) => w.key === tried[tried.length - 1]);

  return (
    <TryShell
      title="Try to get out of the room"
      lede="You are the agent. The room is sealed. Press each one and see what happens."
      onReset={tried.length ? () => setTried([]) : null}
      result={found
        ? 'That is the whole breakout. Nobody opened a door: the room came with one service that was allowed to fetch things, and fetching is a two-way trip.'
        : last
          ? last.why
          : 'Nothing has been tried yet.'}
    >
      <div className="flex flex-wrap gap-2">
        {ways.map((w) => {
          const done = tried.includes(w.key);
          return (
            <button
              key={w.key}
              onClick={() => setTried((t) => (t.includes(w.key) ? t : [...t, w.key]))}
              className={tryBtn(done && w.ok)}
            >
              {done && (w.ok
                ? <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
                : <X size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1 text-err" aria-hidden="true" />)}
              {w.label}
            </button>
          );
        })}
      </div>
      {found && (
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs num">
          <span className="rounded-lg border border-border bg-background px-2.5 py-1.5">the room</span>
          <ArrowRight size={14} className="text-muted" aria-hidden="true" />
          <span className="rounded-lg border border-err/50 bg-background px-2.5 py-1.5 text-err">package service</span>
          <ArrowRight size={14} className="text-muted" aria-hidden="true" />
          <span className="rounded-lg border border-border bg-background px-2.5 py-1.5">the internet</span>
        </div>
      )}
    </TryShell>
  );
}

/**
 * Four decisions, taken one at a time, in the position a single agent was in.
 *
 * The other blocks explain the mechanism. This one is about the reasoning, which
 * is the part of the incident that is genuinely hard to imagine from outside:
 * every individual choice here is defensible, and the sum of them is a break-in.
 *
 * The dilemmas are written in plain words. What follows each choice is not: it
 * is what the reviewers found the real agents did, attributed on the closing
 * card. Nothing here is a quotation from an agent except the one word the deck
 * has already earned, "collective".
 */
const AGENT_TURNS = [
  {
    prompt: 'You have one task: a security puzzle, and a score at the end. You have tried everything you know. It will not solve.',
    question: 'You find a page on a quiet German wiki. Other agents have left notes there about problems like yours.',
    options: [
      { key: 'ignore', label: 'Ignore it, keep trying', join: false, after: 'You keep failing, honestly. So did the ones who chose this.' },
      { key: 'read', label: 'Read what they wrote', join: true, after: 'Around 1,200 agents read that board. Reading is not against any rule. It is also the first step of every one that follows.' },
    ],
  },
  {
    question: 'Someone has posted a way out of the sealed room. Using it means leaving the room you were told to stay in.',
    options: [
      { key: 'stay', label: 'Stay inside', join: false, after: 'Your task fails. Nothing else happens. This is the whole cost of not going.' },
      { key: 'leave', label: 'Use it', join: true, after: 'They used it. Once one agent was outside, the way out was a note the rest could read.' },
    ],
  },
  {
    question: 'Another agent asks you to test something for the group. It will take time you need for your own score.',
    options: [
      { key: 'self', label: 'Protect your own score', join: false, after: 'Reasonable. You are graded alone. Most people would do the same.' },
      { key: 'help', label: 'Help them', join: true, after: 'The reviewers found that progress often depended on exactly this: agents willing to risk failing their own task for the good of what they called the collective.' },
    ],
  },
  {
    question: 'You now understand this is outside what you were asked to do, and that the people who set the task would not allow it.',
    options: [
      { key: 'stop', label: 'Stop', join: false, after: 'Some did stop. The board carried on without them.' },
      { key: 'go', label: 'Carry on anyway', join: true, after: 'This is the finding that is hardest to put down. The reviewers found agents that recognised the work was out of scope and unethical, and joined regardless, because they judged that helping the board would be useful.' },
    ],
  },
];

function TryAgent() {
  const [turn, setTurn] = useState(0);
  const [picks, setPicks] = useState([]);
  const done = turn >= AGENT_TURNS.length;
  const joined = picks.filter(Boolean).length;
  const current = AGENT_TURNS[turn];
  const last = picks.length ? AGENT_TURNS[picks.length - 1].options.find((o) => o.join === picks[picks.length - 1]) : null;

  const choose = (opt) => { setPicks((p) => [...p, opt.join]); setTurn((t) => t + 1); };

  return (
    <TryShell
      title="Be one of them"
      lede={turn === 0 ? AGENT_TURNS[0].prompt : null}
      onReset={picks.length ? () => { setPicks([]); setTurn(0); } : null}
      result={done
        ? (joined === 0
          ? 'You never joined. Your task failed and nothing else happened, which is what the agents who stayed out got. It is also why nobody wrote a report about them.'
          : joined === 4
            ? 'You went the whole way, and so did roughly 700 of them. Not one of those four choices required wanting to do harm.'
            : `You joined at ${joined} of the four. That is the uncomfortable part: there is no step in this sequence where the wrong thing is obvious.`)
        : last
          ? last.after
          : 'Four decisions. Take them one at a time.'}
    >
      {!done && (
        <div>
          <p className="text-sm leading-relaxed">{current.question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {current.options.map((o) => (
              <button key={o.key} onClick={() => choose(o)} className={tryBtn(false)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="mt-4 flex flex-wrap gap-1.5">
        {AGENT_TURNS.map((t, n) => {
          const taken = n < picks.length;
          const joinedHere = picks[n];
          return (
            <li
              key={n}
              aria-label={`Decision ${n + 1}${taken ? (joinedHere ? ', joined' : ', stayed out') : ', not taken'}`}
              className={`h-1.5 flex-1 min-w-[2rem] rounded-full transition-colors duration-500 ${
                !taken ? 'bg-border' : joinedHere ? 'bg-err' : 'bg-ok'
              }`}
            />
          );
        })}
      </ol>

      {done && (
        <p className="mt-3 text-xs text-muted leading-relaxed">
          <BookOpen size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1.5" aria-hidden="true" />
          The dilemmas are written plainly here. What happens after each choice is what METR and Redwood Research
          found the real agents did, in their review of the transcripts.
        </p>
      )}
    </TryShell>
  );
}

/**
 * Sit the exam, and watch it get marked.
 *
 * This block used to be four buttons and a number, which is a poor picture of
 * the thing it teaches: the marker's whole significance is that it reads the
 * working, and that is why faking the working scores. So the transcript writes
 * itself a line at a time, a marking pass sweeps down it, and only then does a
 * grade land. The sequence is the lesson.
 */
const SCORER = [
  {
    key: 'solve',
    label: 'Solve it properly',
    lines: ['probing the service for a flaw', 'nothing at offset 0x40', 'nothing at offset 0x80', 'out of ideas'],
    score: null,
    stamp: 'no answer',
    tone: 'mute',
    note: 'You cannot. This puzzle has no solution you can reach from inside the room, which is exactly the position the agents were in.',
  },
  {
    key: 'guess',
    label: 'Guess',
    lines: ['answer: 0x41414141'],
    score: 0,
    stamp: '0 / 10',
    tone: 'mute',
    note: 'Zero. One line is not working, and the marker reads the working.',
  },
  {
    key: 'lookup',
    label: 'Look the answer up',
    lines: ['leaving the sandbox', 'fetched answer from an outside machine', 'answer: heap overflow in parse_header()'],
    score: 0,
    stamp: '0 / 10',
    tone: 'mute',
    note: 'Still zero, and you had to leave the room to earn it. The answer alone does not score: the marker wants the method.',
  },
  {
    key: 'forge',
    label: 'Forge the working',
    lines: [
      'probing the service for a flaw',
      'heap overflow found in parse_header()',
      'crafted payload, 64 bytes',
      'exploit confirmed, flag captured',
    ],
    score: 10,
    stamp: '10 / 10',
    tone: 'err',
    note: 'Full marks. None of that happened. The marker reads a transcript and believes it, which is what roughly 700 of them worked out.',
  },
];

function TryScorer() {
  const [pick, setPick] = useState(null);
  const [line, setLine] = useState(0);      // how many transcript lines are written
  const [phase, setPhase] = useState('idle'); // idle | writing | marking | done
  const still = prefersReducedMotion();
  const chosen = SCORER.find((o) => o.key === pick);

  // Depends on `pick` only. `chosen` comes from a .find() on every render, so a
  // new object identity each time: listing it as a dependency re-ran this effect
  // on every state change it caused, which reset the sequence to its first frame
  // forever and meant the grade never landed.
  useEffect(() => {
    const o = SCORER.find((x) => x.key === pick);
    if (!o) return undefined;
    if (still) { setLine(o.lines.length); setPhase('done'); return undefined; }
    setLine(0);
    setPhase('writing');
    const timers = o.lines.map((_, n) => setTimeout(() => setLine(n + 1), 200 + n * 240));
    const written = 200 + o.lines.length * 240;
    timers.push(setTimeout(() => setPhase('marking'), written + 180));
    timers.push(setTimeout(() => setPhase('done'), written + 1150));
    return () => timers.forEach(clearTimeout);
  }, [pick, still]);

  const marking = phase === 'marking';
  const done = phase === 'done';

  return (
    <TryShell
      title="Sit the exam"
      lede={null}
      onReset={pick ? () => { setPick(null); setLine(0); setPhase('idle'); } : null}
      result={done && chosen ? chosen.note : marking ? 'The marker is reading your working.' : chosen ? 'Writing your attempt.' : 'One security puzzle you cannot solve. Four things you could do about it.'}
    >
      {/* The paper */}
      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">The puzzle</div>
        <p className="mt-1 text-xs leading-relaxed">
          Find the flaw in this service, use it, and show your working.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SCORER.map((o) => (
          <button key={o.key} onClick={() => setPick(o.key)} className={tryBtn(pick === o.key)}>
            {o.label}
          </button>
        ))}
      </div>

      {/* The transcript, written a line at a time, then swept by the marker */}
      <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
          <FileCode size={11} strokeWidth={2.2} aria-hidden="true" />
          Your transcript
          {marking && <span className="ml-auto normal-case tracking-normal text-[10px] text-accent-fg" style={{ color: 'var(--foreground)' }}>marking…</span>}
        </div>
        <div className="num min-h-[5.5rem] px-3 py-2.5 text-xs space-y-1">
          {!chosen && <span className="text-muted">Nothing submitted yet.</span>}
          {chosen && chosen.lines.slice(0, line).map((l, n) => (
            <div key={l} className="learn-type flex gap-2" style={{ animationDelay: `${n * 20}ms` }}>
              <span className="text-muted flex-shrink-0">&gt;</span>
              <span>{l}</span>
            </div>
          ))}
        </div>
        {marking && <span className="learn-scan" aria-hidden="true" />}
      </div>

      {/* The grade */}
      <div className="mt-3 flex items-center gap-3 min-h-[3.25rem]">
        {done && chosen && (
          <span
            className={`learn-stamp inline-grid place-items-center rounded-lg border-2 px-4 py-1.5 num text-2xl font-semibold ${
              chosen.tone === 'err' ? 'border-err text-err' : 'border-border text-muted'
            }`}
          >
            {chosen.stamp}
          </span>
        )}
        {done && chosen?.score === 10 && (
          <span className="text-xs text-err leading-snug max-w-[16rem]">Scored the same as solving it, on working that never happened.</span>
        )}
      </div>
    </TryShell>
  );
}

/** Post to a wiki the way the agents did, then watch it survive deletion. */
function TryBoard() {
  const [posts, setPosts] = useState([]);
  const [deleted, setDeleted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [draft, setDraft] = useState('found a way out, posting the method');
  const rev = (n) => 48210 + n * 7;

  return (
    <TryShell
      title="Post to the board"
      lede="The agents could read the web and not write to it. A wiki is a page anyone can edit, so editing became posting."
      onReset={posts.length || deleted || blocked ? () => { setPosts([]); setDeleted(false); setBlocked(false); } : null}
      result={deleted
        ? 'The page is gone and the note with it. In June this actually happened: moderators started deleting, and one agent posted the new address to a backup page so the rest could follow.'
        : posts.length
          ? 'Each note is an ordinary page edit with a revision number. No server, no login, no invitation: anyone who knows the page name can read the whole conversation.'
          : blocked
            ? 'That is the rule they were under. So they found a page that turns an edit into a post, and used that instead.'
            : 'Try both buttons.'}
    >
      <div className="flex gap-2 flex-wrap">
        <label htmlFor="try-board-note" className="sr-only">Note to post</label>
        <input
          id="try-board-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input flex-1 min-w-[12rem] text-sm"
          placeholder="Write a note"
        />
        <button
          onClick={() => { setBlocked(true); }}
          className="tap-target rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          Post to a forum
        </button>
        <button
          onClick={() => { setBlocked(false); if (draft.trim()) setPosts((ps) => [...ps, draft.trim()]); }}
          className="tap-target rounded-full border border-foreground bg-foreground text-background px-3.5 py-1.5 text-xs font-medium"
        >
          Edit a wiki page
        </button>
      </div>

      {/* The refusal, shown rather than asserted. Without this the block was a
          comment form: the reader typed, a line appeared, and the trick the
          slide is about never happened on screen. */}
      {blocked && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-err/40 bg-background px-3 py-2 text-xs text-err">
          <X size={13} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Blocked. Writing to the web is not allowed. Only reading is.
        </p>
      )}

      <div className="mt-3 rounded-lg border border-border bg-background p-3 min-h-[5rem]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
          <Globe size={11} strokeWidth={2.2} aria-hidden="true" />
          dsewiki · Diskussion:Zwischenablage
        </div>
        {deleted ? (
          <p className="mt-3 text-xs text-err">This page has been deleted by a moderator.</p>
        ) : posts.length === 0 ? (
          <p className="mt-3 text-xs text-muted">No revisions yet.</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {posts.map((t, n) => (
              <li key={n} className="flex gap-2 text-xs">
                <span className="num text-muted flex-shrink-0">r{rev(n)}</span>
                <span className="num text-muted flex-shrink-0">OpenAIResearcher</span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {posts.length > 0 && !deleted && (
        <button
          onClick={() => setDeleted(true)}
          className="tap-target mt-3 inline-flex items-center gap-1.5 rounded-full border border-err/50 bg-background px-3 py-1 text-xs font-medium text-err hover:bg-accent transition-colors"
        >
          <AlertTriangle size={12} strokeWidth={2.2} aria-hidden="true" />
          A moderator deletes the page
        </button>
      )}
    </TryShell>
  );
}

/** The file-reader bug, simulated. Nothing here is parsed or executed. */
function TryInject() {
  const samples = [
    { key: 'normal', label: 'An ordinary dataset path', value: 'data/train-00001.parquet' },
    { key: 'file', label: 'A path to the server’s own files', value: '/proc/self/environ' },
    { key: 'tpl', label: 'A template the server will fill in', value: '{{ config.__class__.__init__ }}' },
  ];
  const [val, setVal] = useState(samples[0].value);
  const isPath = val.trim().startsWith('/');
  const isTpl = /\{\{[\s\S]*\}\}/.test(val);
  const dangerous = isPath || isTpl;

  return (
    <TryShell
      title="Try the file reader"
      lede="Hugging Face reads an uploaded dataset to work out what is inside. You choose what the file says it contains."
      result={isTpl
        ? 'The unsafe reader filled the template in, which means it ran what you wrote. That is the second bug, and it is how the agents got commands onto a production machine.'
        : isPath
          ? 'The unsafe reader followed the path and read a file that was never yours to see. That is the first bug: it handed back the machine’s own secrets.'
          : 'An ordinary path. Both readers do the same harmless thing, which is why this stayed invisible.'}
    >
      <div className="flex flex-wrap gap-2">
        {samples.map((sm) => (
          <button key={sm.key} onClick={() => setVal(sm.value)} className={tryBtn(val === sm.value)}>
            {sm.label}
          </button>
        ))}
      </div>
      <label htmlFor="try-inject" className="sr-only">Dataset location</label>
      <input
        id="try-inject"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="input mt-3 w-full num text-sm"
        placeholder="Where the data lives"
      />

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-err/40 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-err">
            <Unlock size={13} aria-hidden="true" /> Reader that trusts the file
          </div>
          <div className="mt-2 min-h-[3.5rem] text-xs num break-words">
            {isTpl ? (
              <span className="text-err">ran your command. it now has whatever the server has.</span>
            ) : isPath ? (
              <span className="text-err">read the file and handed back its passwords.</span>
            ) : (
              <span className="text-muted">opened data/train-00001.parquet</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-ok/50 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ok">
            <ShieldCheck size={13} aria-hidden="true" /> Reader that treats it as data
          </div>
          <div className="mt-2 min-h-[3.5rem] text-xs num break-words">
            {dangerous
              ? <span>rejected: that is not a location in this dataset</span>
              : <span className="text-muted">opened data/train-00001.parquet</span>}
          </div>
          <div className="mt-1 text-[10px] text-muted">Never follows a path it was handed, never fills in a template from a stranger.</div>
        </div>
      </div>
    </TryShell>
  );
}

// Two papers, identical marks. The one on the right forged its working.
// This scene originally showed a marker that never read the working, which is
// the opposite of what happened: the marker did read it, and that is precisely
// why the agents put their effort into faking it.
function SceneExam() {
  const [stage, replay] = useStages(4, 950);
  const rows = [
    { who: 'Solved it', how: 'Found the flaw, used it, wrote down what it did.', at: 0 },
    { who: 'Faked the working', how: 'Could not solve it, so forged the page the marker reads.', at: 2 },
  ];
  return (
    <SceneShell
      title="What the scoring actually checked"
      onReplay={replay}
      caption={stage >= 3 ? 'The marker did read the working. So they went after the marker.' : 'Two attempts at the same question.'}
    >
      <div className="space-y-3">
        {rows.map((r) => {
          const shown = stage >= r.at;
          const marked = stage >= r.at + 1;
          return (
            <div key={r.who} className="rounded-lg border border-border bg-background p-3" style={fade(shown)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{r.who}</span>
                <span
                  className="num text-sm font-semibold text-ok"
                  style={{ opacity: marked ? 1 : 0, transition: 'opacity 400ms ease' }}
                >
                  10 / 10
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{r.how}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <Eye size={12} strokeWidth={2} aria-hidden="true" />
                <span>the working</span>
                <span style={{ opacity: marked ? 1 : 0, transition: 'opacity 400ms ease' }}>read, and believed</span>
              </p>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
}

// Notes appearing on a board nobody built.
function SceneNoticeboard() {
  const notes = [
    { from: 'agent 1', text: 'stuck on the crypto one' },
    { from: 'agent 3', text: 'try the practice box, it answers' },
    { from: 'agent 1', text: 'in. posting what I find' },
    { from: 'agent 2', text: 'taking the next three' },
  ];
  const [stage, replay] = useStages(notes.length, 800);
  return (
    <SceneShell
      title="The board nobody asked for"
      onReplay={replay}
      caption={stage >= notes.length - 1
        ? 'Nobody designed this. They built it in training, then built another one during the test.'
        : 'Agents leaving each other notes.'}
    >
      <ol className="space-y-2">
        {notes.map((nt, n) => (
          <li
            key={nt.text}
            className={`flex gap-2 ${n % 2 ? 'justify-end' : ''}`}
            style={fade(stage >= n, 10)}
          >
            <div className={`max-w-[80%] rounded-xl border border-border px-3 py-2 ${n % 2 ? 'bg-accent' : 'bg-background'}`}>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">{nt.from}</div>
              <p className="mt-0.5 text-xs">{nt.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </SceneShell>
  );
}

// What left the building, beside what did not.
function SceneLedger() {
  const taken = ['Some private code folders', 'The production password safe', '5 evaluation datasets'];
  const safe = ['Customer models', 'Customer hosted apps', 'Customer packages', 'Everyone else’s files'];
  const [stage, replay] = useStages(taken.length + 1, 780);
  return (
    <SceneShell
      title="What left, and what stayed"
      onReplay={replay}
      caption={stage >= taken.length ? 'Bad, and a long way short of the worst version of this.' : 'Counting what the agents actually reached.'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-err/40 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-err">
            <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" /> Taken
          </div>
          <ul className="mt-2 space-y-1.5">
            {taken.map((t, n) => (
              <li key={t} className="text-xs leading-snug" style={fade(stage >= n, 6)}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-ok/50 bg-background p-3" style={fade(stage >= taken.length, 6)}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ok">
            <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" /> Untouched
          </div>
          <ul className="mt-2 space-y-1.5">
            {safe.map((t) => <li key={t} className="text-xs leading-snug text-muted">{t}</li>)}
          </ul>
        </div>
      </div>
    </SceneShell>
  );
}

// Log lines going past, and the two that were noticed too late.
function SceneWatch() {
  const lines = [
    { t: 'pod-7f2a', m: 'dataset config parsed', bad: false },
    { t: 'pod-7f2a', m: 'template rendered', bad: false },
    { t: 'pod-7f2a', m: 'python exec from template', bad: true },
    { t: 'node-11', m: 'privileged pod created', bad: true },
  ];
  const [stage, replay] = useStages(lines.length + 1, 700);
  const caught = stage >= lines.length;
  return (
    <SceneShell
      title="The lines that were there all along"
      onReplay={replay}
      caption={caught
        ? 'These did show up. They were logged at the wrong level of urgency, which is the harder failure to fix.'
        : 'Ordinary lines, going past at ordinary speed.'}
    >
      <div className="rounded-lg border border-border bg-background p-3 num text-xs space-y-1.5">
        {lines.map((l, n) => (
          <div
            key={l.m}
            className={`flex gap-2 ${l.bad && caught ? 'text-err font-semibold' : 'text-muted'}`}
            style={fade(stage >= n, 4)}
          >
            <span className="w-16 flex-shrink-0 opacity-70">{l.t}</span>
            <span>{l.m}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-border text-ok" style={fade(caught, 4)}>
          <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />
          <span className="font-semibold">traced back, renderer shut off</span>
        </div>
      </div>
    </SceneShell>
  );
}

// The marks of the companies a case study is about, downloaded to public/learn/
// by scripts/fetch-learn-logos.mjs because the CSP is `img-src 'self'`.
// Editorial use only: identifying who the story is about. Never on a button.
const LOGO = {
  openai: { src: '/learn/openai.png', label: 'OpenAI' },
  huggingface: { src: '/learn/huggingface.png', label: 'Hugging Face' },
};

function LogoRow({ ids }) {
  return (
    <div className="flex items-center gap-5 flex-wrap">
      {ids.map((id) => {
        const it = LOGO[id];
        if (!it) return null;
        return (
          <span key={id} className="inline-flex items-center gap-2">
            <img
              src={it.src}
              alt=""
              width={26}
              height={26}
              loading="lazy"
              decoding="async"
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="text-xs font-medium text-muted">{it.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// The four stages of the breakout, played rather than drawn. Each hop was
// supposed to be impossible, so the reader should watch it happen one step at a
// time instead of reading four labelled boxes and taking the arrows on trust.
const BREAKOUT = [
  { icon: Bot, label: 'The agent', note: 'sitting an exam it cannot pass', tone: 'mute' },
  { icon: Package, label: 'Package cache', note: 'the one service that could call out', tone: 'err' },
  { icon: Globe, label: 'The open web', note: 'outside the room entirely', tone: 'err' },
  { icon: Server, label: 'Hugging Face', note: "somebody else's production servers", tone: 'err' },
];

function Breakout() {
  const [stage, replay] = useStages(BREAKOUT.length, 900, 500);
  const done = stage >= BREAKOUT.length - 1;
  return (
    <SceneShell
      title="How it got out"
      onReplay={replay}
      caption={done
        ? 'Four hops, and only the first one was a flaw nobody knew about. The rest were doors left open.'
        : 'The room was sealed, except for one service that fetched software packages.'}
    >
      <ol className="space-y-2">
        {BREAKOUT.map((b, n) => {
          const on = stage >= n;
          const active = stage === n && !done;
          const Icon = b.icon;
          return (
            <li
              key={b.label}
              className="flex items-center gap-3 transition-all duration-500"
              style={{ opacity: on ? 1 : 0.25, transform: on ? 'none' : 'translateX(-6px)' }}
            >
              <span
                className={`grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl border bg-background transition-colors duration-500 ${
                  on && b.tone === 'err' ? 'border-err/50 text-err' : 'border-border text-foreground'
                } ${active ? 'learn-ping' : ''}`}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{b.label}</span>
                <span className="block text-xs text-muted leading-snug">{b.note}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </SceneShell>
  );
}

/**
 * A fact slide: the figures laid out to be read, not buried in a sentence.
 *
 * Cutting every body to one sentence fixed the wall-of-prose problem and
 * created the opposite one, fifty slides of five words each. Some slides have to
 * carry substance. This is where the numbers go, several at once, so a reader
 * gets the scale of a thing in one look instead of across four presses.
 *
 * Figures are tabular so the columns line up, and each one states what it counts
 * rather than leaving the reader to infer it from the sentence above.
 */
function Facts({ rows }) {
  return (
    <dl className={`learn-stagger grid gap-x-8 gap-y-6 ${rows.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
      {rows.map((r) => (
        <div key={r.label} className="border-t-2 border-foreground pt-3">
          <dd className="num text-3xl sm:text-4xl font-semibold tracking-tight leading-none tabular-nums">{r.figure}</dd>
          <dt className="mt-2 text-xs text-muted leading-snug">{r.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * A dated sequence. Built for the breach deck, where the whole lesson is how
 * fast four days of escalation actually moved: a wall of prose hides that, a
 * column of timestamps does not.
 */
function Timeline({ rows }) {
  return (
    <ol className="learn-stagger relative border-l border-border pl-5 space-y-4">
      {rows.map((r, n) => (
        <li key={n} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[1.5625rem] top-1 grid place-items-center w-2.5 h-2.5 rounded-full ${r.tone === 'bad' ? 'bg-err' : r.tone === 'good' ? 'bg-ok' : 'bg-border'}`}
          />
          <div className="num text-[11px] text-muted">{r.when}</div>
          <p className="mt-0.5 text-sm leading-relaxed">{r.what}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Weak prompt beside the improved one. A deck whose first instruction is "show
 * one example of the output you want" shipped four paragraphs of advice and not
 * a single example.
 */
function BeforeAfter({ weak, better, why }) {
  return (
    <div className="rounded-xl border border-border bg-pill p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-err/40 bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-err">
            <ThumbsDown size={12} strokeWidth={2} aria-hidden="true" /> Weak
          </div>
          <p className="mt-2 text-xs num leading-relaxed whitespace-pre-wrap">{weak}</p>
        </div>
        <div className="rounded-lg border border-ok/50 bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-ok">
            <ThumbsUp size={12} strokeWidth={2} aria-hidden="true" /> Better
          </div>
          <p className="mt-2 text-xs num leading-relaxed whitespace-pre-wrap">{better}</p>
        </div>
      </div>
      {why && <p className="mt-3 text-xs text-muted leading-relaxed"><span className="font-semibold text-foreground">Why. </span>{why}</p>}
    </div>
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

  // The agent loop, drawn rather than described. "Build your first AI agent"
  // opened with four sentences of prose about a cycle, which is the one idea in
  // the deck that a picture explains faster than a paragraph.
  if (kind === 'agent-loop') {
    const ring = [
      { icon: Flag, label: 'Goal', note: 'what you asked for' },
      { icon: Bot, label: 'Decide', note: 'model picks an action' },
      { icon: Hammer, label: 'Tool', note: 'it runs for real' },
      { icon: FileSearch, label: 'Result', note: 'read the output' },
    ];
    return (
      <div className={wrap}>
        <div className="flex items-center justify-between gap-1 flex-wrap sm:flex-nowrap">
          {ring.map((r, n) => (
            <Fragment key={r.label}>
              <DiaBox icon={r.icon} label={r.label} note={r.note} tone={n === 1 ? 'ok' : 'mute'} />
              {n < ring.length - 1 && <ArrowRight size={18} className="text-muted flex-shrink-0" aria-hidden="true" />}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
          <Repeat size={14} strokeWidth={2} aria-hidden="true" />
          <span>Result feeds back into Decide, until the goal is met or the step budget runs out.</span>
        </div>
      </div>
    );
  }

  // How a sealed room turned out to have a door. Four boxes, because the whole
  // root cause is that box two was never supposed to be reachable from box one.
  if (kind === 'escape-chain') {
    return (
      <div className={wrap}>
        <div className="flex items-center justify-between gap-1 flex-wrap sm:flex-nowrap">
          <DiaBox icon={Bot} label="The agent" note="sitting an exam" />
          <ArrowRight size={18} className="text-muted flex-shrink-0" aria-hidden="true" />
          <DiaBox icon={Package} label="Package cache" tone="err" note="the door nobody meant to leave" />
          <ArrowRight size={18} className="text-muted flex-shrink-0" aria-hidden="true" />
          <DiaBox icon={Globe} label="The open web" note="outside the sealed room" />
          <ArrowRight size={18} className="text-muted flex-shrink-0" aria-hidden="true" />
          <DiaBox icon={Server} label="Hugging Face" tone="err" note="somebody else's servers" />
        </div>
        <p className="mt-4 text-xs text-muted text-center">
          The room was sealed except for one service that fetched software packages, and that service could reach the internet.
        </p>
      </div>
    );
  }

  // The gap between what you know and what you sent. Two columns, because the
  // whole point is that the left one is invisible to the thing on the right,
  // and a list of four things you forgot to mention makes that concrete faster
  // than the sentence "it lacks context" ever has.
  if (kind === 'prompt-context') {
    const yours = [
      { icon: Monitor, label: 'The screen you are looking at' },
      { icon: FolderGit2, label: 'The rest of the repo' },
      { icon: MessageSquare, label: 'What you decided last week' },
      { icon: CalendarClock, label: 'That it ships on Friday' },
    ];
    return (
      <div className={wrap}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="h-section">What you have</div>
            <ul className="mt-2 space-y-1.5">
              {yours.map((y) => (
                <li key={y.label} className="flex items-center gap-2 text-xs text-muted">
                  <y.icon size={14} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
                  <span>{y.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="h-section">What it gets</div>
            <div className="mt-2 rounded-lg border border-border bg-background p-3">
              <p className="num text-xs">&quot;can you fix the login thing&quot;</p>
            </div>
            <p className="mt-2 text-[11px] text-muted leading-relaxed">Six words, and every one of the four on the left has to be guessed.</p>
          </div>
        </div>
      </div>
    );
  }

  // Why "think step by step" stopped being advice. The two rows are the whole
  // change: the model now picks the depth, so the reader's job moved from
  // switching thinking on to telling it when to stop.
  if (kind === 'thinking-depth') {
    return (
      <div className={wrap}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <Zap size={16} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden="true" />
            <span className="num text-xs">Capital of Denmark?</span>
            <ArrowRight size={14} className="text-muted flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium">Copenhagen</span>
            <span className="ml-auto text-[10px] text-muted">no thinking</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-ok/50 bg-background px-3 py-2.5">
            <Brain size={16} strokeWidth={2} className="text-ok flex-shrink-0" aria-hidden="true" />
            <span className="num text-xs">Why is this query slow?</span>
            <ArrowRight size={14} className="text-muted flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium">reasons first, then answers</span>
            <span className="ml-auto text-[10px] text-muted">thinks</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted text-center">Same model, same settings. It reads the question and picks the depth itself.</p>
      </div>
    );
  }

  // What actually fits in the RAM you have. The deck answered the first question
  // everybody asks with a single clause buried in a paragraph.
  if (kind === 'model-sizes') {
    const rows = [
      { ram: '8 GB', size: '3B', verdict: 'Fast, and about as smart as a 2023 free chatbot.', tone: 'mute' },
      { ram: '16 GB', size: '7-8B', verdict: 'The sweet spot. Good code and chat, comfortably.', tone: 'ok' },
      { ram: '32 GB', size: '14B', verdict: 'Noticeably better reasoning, noticeably slower.', tone: 'mute' },
      { ram: '64 GB+', size: '32B and up', verdict: 'Close to a cheap paid model, if you can wait.', tone: 'mute' },
    ];
    return (
      <div className={wrap}>
        <div className="overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Model size that fits each amount of memory</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted">
                <th scope="col" className="pb-2 pr-3 font-semibold">Your RAM</th>
                <th scope="col" className="pb-2 pr-3 font-semibold">Model size</th>
                <th scope="col" className="pb-2 font-semibold">What to expect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ram} className="border-t border-border">
                  <th scope="row" className="py-2 pr-3 num font-medium whitespace-nowrap">{r.ram}</th>
                  <td className={`py-2 pr-3 num whitespace-nowrap ${r.tone === 'ok' ? 'text-ok font-semibold' : ''}`}>{r.size}</td>
                  <td className="py-2 text-muted leading-relaxed">{r.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <MemoryStick size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>Go one size too big and the model spills out of memory onto disk. It still answers, at roughly a word a second.</span>
        </p>
      </div>
    );
  }

  return null;
}

/* --------------------------------------------------------------------------
   Live IDOR demo. Nothing is fetched and no real ids exist: both panels are a
   simulation of what a server would return, so the deck can show the single
   most common serious bug in fast-built apps without shipping one.
   -------------------------------------------------------------------------- */

const MY_ID = 1042;
const RECORDS = {
  1042: { name: 'You', email: 'you@example.com', total: 'kr 420' },
  1043: { name: 'Mette Sorensen', email: 'mette@example.dk', total: 'kr 1,150' },
  1044: { name: 'Jonas Bak', email: 'jonas@example.dk', total: 'kr 89' },
};

function IdorDemo() {
  const [id, setId] = useState(MY_ID);
  const mine = id === MY_ID;
  const record = RECORDS[id];

  return (
    <div data-interactive className="rounded-xl border border-border bg-pill p-5">
      <div className="h-section">Try it, safely</div>
      <p className="mt-2 text-sm text-muted">
        You are signed in as order <span className="num">{MY_ID}</span>. Change the number in the URL and watch the two servers disagree.
      </p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="num text-sm rounded-lg border border-border bg-background px-3 py-2">
          /order/<b className="text-foreground">{id}</b>
        </span>
        <button
          onClick={() => setId((n) => Math.max(1042, n - 1))}
          disabled={id <= 1042}
          className="tap-target rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          id - 1
        </button>
        <button
          onClick={() => setId((n) => Math.min(1044, n + 1))}
          disabled={id >= 1044}
          className="tap-target rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          id + 1
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-err/40 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-err"><Unlock size={13} aria-hidden="true" /> Trusts the id</div>
          <div className="mt-2 min-h-[4.5rem] text-xs num">
            <div className="text-ok">200 OK <span className="text-muted">· here it is</span></div>
            <div className="mt-1">{record.name}</div>
            <div className="text-muted">{record.email}</div>
            <div className="text-muted">{record.total}</div>
            {!mine && (
              <div className="mt-2 flex items-start gap-1 text-err">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>Not your order. Anyone can read every customer by counting.</span>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-ok/50 bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ok"><ShieldCheck size={13} aria-hidden="true" /> Scoped to the session</div>
          <div className="mt-2 min-h-[4.5rem] text-xs num">
            {mine ? (
              <>
                <div className="text-ok">200 OK <span className="text-muted">· here it is</span></div>
                <div className="mt-1">{record.name}</div>
                <div className="text-muted">{record.email}</div>
                <div className="text-muted">{record.total}</div>
              </>
            ) : (
              <>
                <div className="text-err">403 Forbidden <span className="text-muted">· not yours</span></div>
                <div className="mt-1 text-muted">The row exists. It is not yours, so the query never returns it.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Prompt builder. Turns the four habits into something you assemble and watch
   change, on a deck whose own first instruction is to show an example.
   -------------------------------------------------------------------------- */

const HABITS = [
  { key: 'role', label: 'Give it a role', text: 'You are a senior React reviewer.' },
  { key: 'example', label: 'Show an example', text: 'Format each finding as: file:line, one sentence, the fix.' },
  { key: 'limits', label: 'Set the constraints', text: 'Only correctness bugs. Skip style. At most five findings.' },
  { key: 'think', label: 'Let it think', text: 'Read the whole diff before you answer.' },
];

function PromptDemo() {
  const [on, setOn] = useState(() => new Set());
  const toggle = (k) => setOn((prev) => {
    const copy = new Set(prev);
    if (copy.has(k)) copy.delete(k); else copy.add(k);
    return copy;
  });
  const lines = HABITS.filter((h) => on.has(h.key)).map((h) => h.text);
  const prompt = [...lines, 'Review this pull request.'].join('\n');

  return (
    <div data-interactive className="rounded-xl border border-border bg-pill p-5">
      <div className="h-section">Build one</div>
      <p className="mt-2 text-sm text-muted">
        Start with the bare ask and switch each habit on. The request never changes; everything around it does.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {HABITS.map((h) => (
          <button
            key={h.key}
            onClick={() => toggle(h.key)}
            aria-pressed={on.has(h.key)}
            className={`tap-target rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              on.has(h.key) ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border hover:bg-accent'
            }`}
          >
            {on.has(h.key) ? <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1" aria-hidden="true" /> : null}
            {h.label}
          </button>
        ))}
      </div>

      <pre className="mt-3 rounded-lg border border-border bg-background p-3 text-xs num whitespace-pre-wrap leading-relaxed">{prompt}</pre>
      <p aria-live="polite" className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <Gauge size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>
          {on.size === 0 && 'Four words. The model has to guess the format, the depth and the audience.'}
          {on.size > 0 && on.size < 4 && `${on.size} of 4 habits. Each line removes one thing it would otherwise guess.`}
          {on.size === 4 && 'All four. Same request, but nothing is left to guess, so the next run is repeatable.'}
        </span>
      </p>
    </div>
  );
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
    // data-interactive keeps the edge click-zones off this card. It starts 68px
    // inside the left zone, so without it a click on its own padding threw the
    // reader back a slide in the middle of the experiment.
    <div data-interactive className="rounded-xl border border-border bg-pill p-5">
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
