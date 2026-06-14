import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, X, ListChecks, FileText, AlertTriangle } from 'lucide-react';
import { fmtDateLong } from '../lib/dates.js';
import { iconFor } from '../lib/topicIcons.js';
import TopicFiles from './TopicFiles.jsx';

// Full-screen slide deck of the day's topics, opened via the "Present" link
// (#present, usually in a new tab so it can drive a projector while the dashboard
// stays on the laptop). Same look + keyboard controls as the Learn viewer.
// Cover slide, then one slide per topic; flow topics render as a big pipeline.
function buildSlides(session) {
  const topics = session?.topics || [];
  const slides = [{ kind: 'cover', date: session?.date }];
  topics.forEach((topic, i) => {
    const isObj = topic && typeof topic === 'object';
    const files = isObj ? (topic.files || []) : [];
    slides.push({
      kind: 'topic',
      n: i + 1,
      total: topics.length,
      title: isObj ? topic.title : topic,
      points: isObj ? (topic.points || []) : [],
      flow: isObj ? (topic.flow || []) : [],
      files,
      note: isObj ? topic.note : '',
      image: isObj ? topic.image : '',
    });
    // Drill-down: each file with main rules becomes its own slide after the topic.
    files.forEach((f) => {
      if (f.rules?.length) slides.push({ kind: 'file', name: f.name, does: f.does, rules: f.rules, risk: f.risk });
    });
  });
  return slides;
}

export default function TopicsPresentation({ session, onClose }) {
  const slides = useMemo(() => buildSlides(session), [session]);
  const [i, setI] = useState(0);
  const total = slides.length;
  const go = (d) => setI((x) => Math.min(total - 1, Math.max(0, x + d)));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const s = slides[i];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 border-b border-border">
        <span className="text-xs text-muted num">{i + 1} / {total}</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted truncate">
          <ListChecks size={13} strokeWidth={2.2} /> Topics for the day
        </span>
        <button onClick={() => onClose?.()} className="grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-accent transition-colors" aria-label="Close"><X size={18} /></button>
      </div>

      {/* Slide */}
      <div className="flex-1 overflow-y-auto flex px-6 sm:px-10 py-8">
        <div className="m-auto w-full max-w-4xl">
          {s.kind === 'cover' && (
            <div className="text-center">
              <div className="h-section justify-center inline-flex items-center gap-1.5">
                <ListChecks size={11} strokeWidth={2.2} /> Today's session
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight">What we'll talk about</h2>
              {s.date && <p className="mt-4 text-lg text-muted">{fmtDateLong(s.date)}</p>}
              <button onClick={() => go(1)} className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]">
                Start <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {s.kind === 'topic' && (
            <div>
              <div className="h-section">Topic {s.n} of {s.total}</div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight">{s.title}</h2>

              {s.image && (
                <img
                  src={s.image}
                  alt={s.title}
                  className="mt-6 w-full max-h-[40vh] object-cover rounded-2xl border border-border"
                />
              )}

              {s.flow.length > 0 && <FlowBig steps={s.flow} />}

              {s.files.length > 0 && <TopicFiles files={s.files} size="lg" />}

              {s.points.length > 0 && (
                <ul className="mt-6 flex flex-col gap-3 max-w-2xl">
                  {s.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-3 text-lg text-foreground">
                      <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-foreground/50" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}

              {s.note && <p className="mt-6 text-sm text-muted italic border-l-2 border-border pl-3 max-w-2xl">{s.note}</p>}
            </div>
          )}

          {s.kind === 'file' && (
            <div>
              <div className="h-section inline-flex items-center gap-1.5"><FileText size={11} strokeWidth={2.2} /> The file</div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight num">{s.name}</h2>
              {s.does && <p className="mt-3 text-lg text-muted leading-relaxed max-w-2xl">{s.does}</p>}

              {/* Left = the rule, right = what happens without it. */}
              <div className="mt-7 grid grid-cols-2 gap-4 px-1 pb-1 max-w-3xl text-[11px] uppercase tracking-wide font-semibold">
                <span className="text-muted">The rule</span>
                <span className="text-warn">Without it</span>
              </div>
              <ul className="flex flex-col gap-2 max-w-3xl">
                {s.rules.map((r, j) => {
                  const isObj = r && typeof r === 'object';
                  const rule = isObj ? r.rule : r;
                  const without = isObj ? r.without : '';
                  return (
                    <li key={j} className="grid sm:grid-cols-2 gap-1.5 sm:gap-4 rounded-xl border border-border bg-pill p-3 sm:p-4">
                      <div className="flex items-start gap-2.5 text-base text-foreground">
                        <span className="num text-muted flex-shrink-0 mt-0.5">{j + 1}.</span>
                        <span>{rule}</span>
                      </div>
                      {without && (
                        <div className="flex items-start gap-2 text-sm text-warn sm:border-l sm:border-border sm:pl-4">
                          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                          <span>{without}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 border-t border-border">
        <button onClick={() => go(-1)} disabled={i === 0} className="grid place-items-center w-10 h-10 rounded-full border border-border bg-background text-foreground transition disabled:opacity-30 enabled:hover:bg-accent" aria-label="Previous slide"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} aria-label={`Go to slide ${idx + 1}`} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-foreground' : 'w-1.5 bg-border hover:bg-muted'}`} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={i === total - 1} className="grid place-items-center w-10 h-10 rounded-full border border-border bg-background text-foreground transition disabled:opacity-30 enabled:hover:bg-accent" aria-label="Next slide"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

// Big pipeline for a slide: a row of step cards on desktop (chevrons between),
// stacked with down-chevrons on mobile. No text arrows — Lucide chevrons only.
function FlowBig({ steps }) {
  return (
    <div className="mt-7 flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-1">
      {steps.map((step, i) => {
        const Icon = iconFor(step.icon);
        const last = i === steps.length - 1;
        return (
          <div key={i} className="flex flex-col sm:flex-row sm:items-stretch sm:flex-1">
            <div className="flex-1 rounded-2xl border border-border bg-pill p-4 flex flex-col items-start gap-2">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-background border border-border text-foreground">
                <Icon size={19} strokeWidth={2} />
              </span>
              <div className="text-sm font-semibold tracking-tight">{step.label}</div>
              {step.detail && <div className="text-[13px] text-muted leading-snug">{step.detail}</div>}
            </div>
            {!last && (
              <div className="flex items-center justify-center text-muted px-0.5 py-1 sm:py-0">
                <ChevronRight size={18} className="hidden sm:block" />
                <ChevronDown size={18} className="sm:hidden" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
