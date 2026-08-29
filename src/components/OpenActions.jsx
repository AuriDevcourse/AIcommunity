import { useState } from 'react';
import { CheckSquare, ChevronDown } from 'lucide-react';

const INITIAL_VISIBLE = 8;

// Group by where the item came from — the hub note, or a numbered session.
function groupBySource(actions) {
  const groups = new Map();
  for (const a of actions) {
    const key = a.source || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  // Hub items first, then sessions newest-first (`#12` before `#2`, so compare
  // numerically rather than as strings).
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === 'hub') return -1;
    if (b === 'hub') return 1;
    const na = parseInt(String(a).replace('#', ''), 10);
    const nb = parseInt(String(b).replace('#', ''), 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return String(a).localeCompare(String(b));
    return nb - na;
  });
}

export default function OpenActions({ actions }) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(actions) ? actions.filter((a) => a && a.text) : [];

  if (list.length === 0) {
    return (
      <div className="card card-pad">
        <div className="h-section flex items-center gap-1.5">
          <CheckSquare size={11} strokeWidth={2.2} />
          <span>Open actions</span>
        </div>
        <p className="mt-3 text-sm text-muted">Nothing outstanding — every action item in the notes is ticked off.</p>
      </div>
    );
  }

  const grouped = groupBySource(list);
  const limit = expanded ? list.length : INITIAL_VISIBLE;

  // Pre-compute the slices instead of mutating a counter inside .map(): render
  // must stay a pure function of props/state, and a mutation that only works
  // because map happens to run in order is a trap for the next editor.
  const visibleGroups = [];
  let budget = limit;
  for (const [source, items] of grouped) {
    if (budget <= 0) break;
    const slice = items.slice(0, budget);
    budget -= slice.length;
    if (slice.length) visibleGroups.push([source, slice]);
  }

  return (
    <div className="card card-pad">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-section flex items-center gap-1.5">
          <CheckSquare size={11} strokeWidth={2.2} />
          <span>Open actions</span>
        </div>
        <div className="text-xs text-muted num">{list.length} open</div>
      </div>

      <div className="mt-3 space-y-4">
        {visibleGroups.map(([source, items]) => (
          <div key={source}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted mb-1.5">
              {source === 'hub' ? 'Hub' : `Session ${source}`}
            </div>
            <ul className="space-y-1">
              {items.map((a, i) => (
                <li key={`${source}-${i}`} className="flex items-start gap-2 text-sm">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted" aria-hidden />
                  <span className="text-foreground">{a.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {list.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline underline-offset-2"
        >
          <ChevronDown size={13} strokeWidth={2.2} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          {expanded ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}
