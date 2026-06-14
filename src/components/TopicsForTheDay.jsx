import { ListChecks, Presentation, Info, Image as ImageIcon } from 'lucide-react';
import { fmtDateLong } from '../lib/dates.js';
import { iconFor } from '../lib/topicIcons.js';
import TopicFiles from './TopicFiles.jsx';

// Left column of the Forum tab: the discussion topics for the next session.
// A topic is either a simple {title, points[]} box or a {title, flow[]} box that
// renders the points as a small visual pipeline (used for "how recording works").
// "Present" opens the same topics as a full-screen slide deck in a new tab.
// Tolerates plain-string topics so older data never breaks the render.
export default function TopicsForTheDay({ session }) {
  const topics = session?.topics || [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5 h-section">
          <ListChecks size={11} strokeWidth={2.2} />
          <span>Topics for the day</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mt-1">What we'll talk about</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          {session?.date && <p className="text-sm text-muted">{fmtDateLong(session.date)}</p>}
          {topics.length > 0 && (
            <a
              href="#present"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Presentation size={13} strokeWidth={2.2} /> Present
            </a>
          )}
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="card card-pad text-sm text-muted">No topics set for the next session yet.</div>
      ) : (
        <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-1">
          {topics.map((topic, i) => {
            const isObj = topic && typeof topic === 'object';
            const title = isObj ? topic.title : topic;
            const points = isObj ? (topic.points || []) : [];
            const flow = isObj ? (topic.flow || []) : [];
            const files = isObj ? (topic.files || []) : [];
            const note = isObj ? topic.note : '';
            const image = isObj ? topic.image : '';
            return (
              <div key={i} className="card card-pad">
                <TopicImage src={image} alt={title} />
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-7 h-7 rounded-lg bg-accent text-foreground flex-shrink-0 text-sm font-semibold num">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight">{title}</div>

                    {flow.length > 0 && <FlowStepper steps={flow} />}

                    {files.length > 0 && <TopicFiles files={files} />}

                    {points.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {points.map((p, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-foreground/40" aria-hidden />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {note && (
                      <p className="mt-3 inline-flex items-start gap-1.5 text-[12px] text-muted">
                        <Info size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                        <span>{note}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A topic's picture. Shows the image when set, otherwise a slim muted placeholder
// so it's visible that pictures can be added here later.
function TopicImage({ src, alt }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        className="mb-3 w-full h-32 object-cover rounded-xl border border-border"
      />
    );
  }
  return (
    <div className="mb-3 w-full h-16 rounded-xl border border-dashed border-border bg-pill grid place-items-center text-muted">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
        <ImageIcon size={13} strokeWidth={2} /> Picture coming soon
      </span>
    </div>
  );
}

// Compact vertical pipeline: icon + label + detail per step, joined by a line.
function FlowStepper({ steps }) {
  return (
    <ol className="mt-3 flex flex-col">
      {steps.map((step, i) => {
        const Icon = iconFor(step.icon);
        const last = i === steps.length - 1;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="grid place-items-center w-8 h-8 rounded-full border border-border bg-pill text-foreground flex-shrink-0">
                <Icon size={15} strokeWidth={2} />
              </span>
              {!last && <span className="w-px flex-1 bg-border my-1" aria-hidden />}
            </div>
            <div className={`min-w-0 ${last ? '' : 'pb-3'}`}>
              <div className="text-sm font-medium text-foreground">{step.label}</div>
              {step.detail && <div className="text-[12px] text-muted leading-snug mt-0.5">{step.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
