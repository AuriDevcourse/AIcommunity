import { Lightbulb } from 'lucide-react';

// Entries are hand-written in data/backlog.json and may be a bare string or an
// object, so normalise rather than assuming a shape.
function normalise(entry) {
  if (typeof entry === 'string') return { topic: entry };
  if (entry && typeof entry === 'object') return entry;
  return null;
}

export default function DemoBacklog({ backlog }) {
  const items = (Array.isArray(backlog) ? backlog : []).map(normalise).filter((x) => x && (x.topic || x.presenter));

  return (
    <div className="card card-pad">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-section flex items-center gap-1.5">
          <Lightbulb size={11} strokeWidth={2.2} />
          <span>Demo backlog</span>
        </div>
        <div className="text-xs text-muted">
          edit <span className="font-mono text-foreground">data/backlog.json</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing queued. With fewer than two demos the next session falls back to Lean Coffee.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={`${item.topic || item.presenter}-${i}`} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-foreground">{item.topic || 'Untitled demo'}</div>
                {item.notes && <div className="text-xs text-muted mt-0.5">{item.notes}</div>}
              </div>
              <span className={`pill flex-shrink-0 ${item.presenter ? 'pill-ok' : 'pill-mute'}`}>
                {item.presenter || 'no presenter'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
