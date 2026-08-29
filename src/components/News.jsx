import { useMemo, useRef, useState } from 'react';
import { Search, ExternalLink, ChevronDown, X } from 'lucide-react';
import news from '../../data/news.json';
import { TODAY, daysBetween, parseDate } from '../lib/dates.js';

function NewsImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">no image</div>;
  }
  return (
    <>
      {/* Area 6.7 — a shimmer holds the frame so the grid doesn't flash empty. */}
      {!loaded && <div className="absolute inset-0 skeleton rounded-none" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={640}
        height={360}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

const CATEGORY_LABEL = {
  global: 'Global',
  'eu-policy': 'EU / Denmark / Policy',
  'lt-community': 'LT Community',
};

const CHIP_LABEL = {
  global: 'Global',
  'eu-policy': 'EU / Policy',
  'lt-community': 'LT Community',
};

const CARD_BADGE = {
  global: 'Global',
  'eu-policy': 'EU / Policy',
  'lt-community': 'LT',
};

// Preferred chip order; any category present in the data but missing here is
// appended alphabetically rather than silently dropped. `lt-community` is kept
// as a known label even though it currently has no stories — the labels are
// harmless, and chips are built from the data so it can never go dead again.
const CATEGORY_ORDER = ['global', 'eu-policy', 'lt-community'];

// Only build chips for categories that actually have stories, so the filter bar
// can never offer a dead choice that leads to an empty grid.
function buildCategories(items) {
  const counts = new Map();
  for (const item of items) {
    const key = item.category || 'global';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const keys = [...counts.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return [
    { key: 'all', label: 'All', count: items.length },
    ...keys.map((key) => ({ key, label: CHIP_LABEL[key] || key, count: counts.get(key) })),
  ];
}

// A roundup older than this stops being "news" and starts being an archive.
const STALE_AFTER_DAYS = 21;

function dateRange(items) {
  const dates = items.map((i) => i.date).filter((d) => typeof d === 'string' && d).sort();
  return { oldest: dates[0] || '', newest: dates[dates.length - 1] || '' };
}

// Derived from the items themselves rather than trusting a hand-typed
// `windowLabel`, which drifts the moment someone appends a story.
function windowLabel({ oldest, newest }) {
  if (!oldest) return news.windowLabel || '';
  const end = parseDate(newest);
  const start = parseDate(oldest);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-GB', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return oldest === newest ? endStr : `${startStr} – ${endStr}`;
}

// Area 6.5 — sets expectation before the click. 200 wpm is the usual estimate.
function readingMinutes(item) {
  const words = [item.summary, item.whyItMatters, item.whyForUs]
    .filter(Boolean).join(' ').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function stalenessLabel(newestIso) {
  if (!newestIso) return null;
  // Uses the app-wide TODAY constant so every component agrees on "now".
  const age = daysBetween(TODAY, newestIso) * -1;
  if (!Number.isFinite(age) || age <= STALE_AFTER_DAYS) return null;
  if (age < 60) return `${age} days`;
  return `${Math.floor(age / 30)} months`;
}

export default function News() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const chipsRef = useRef(null);
  const allItems = Array.isArray(news.items) ? news.items : [];
  const themes = news.themes && typeof news.themes === 'object' ? news.themes : {};
  const categories = buildCategories(allItems);
  // Area 6.3 — newest first, stated rather than relying on the file's order.
  const sorted = useMemo(
    () => [...allItems].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [allItems]
  );

  // Area 6.2 — twelve stories is already past the point of scanning.
  const q = query.trim().toLowerCase();
  const items = useMemo(() => {
    const byCategory = filter === 'all' ? sorted : sorted.filter((i) => (i.category || 'global') === filter);
    if (!q) return byCategory;
    return byCategory.filter((i) =>
      [i.title, i.subtitle, i.summary, i.whyItMatters, i.whyForUs]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [sorted, filter, q]);

  // Area 6.9 — arrow keys move across the filter row.
  function onChipsKeyDown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const nodes = [...(chipsRef.current?.querySelectorAll('button[data-chip]') || [])];
    if (!nodes.length) return;
    const i = nodes.indexOf(document.activeElement);
    let n = 0;
    if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = nodes.length - 1;
    else if (i === -1) n = 0;
    else n = (i + (e.key === 'ArrowRight' ? 1 : -1) + nodes.length) % nodes.length;
    e.preventDefault();
    nodes[n].focus();
  }
  const range = dateRange(sorted);
  const stale = stalenessLabel(range.newest);
  // Only show a theme statement for a category that actually has stories,
  // otherwise the prose contradicts the (data-derived) chip row below it.
  const liveCategories = new Set(categories.map((c) => c.key));
  const liveThemes = Object.entries(themes).filter(([key]) => liveCategories.has(key));

  if (allItems.length === 0) {
    return (
      <div className="card card-pad">
        <div className="h-section">AI News Roundup</div>
        <p className="mt-3 text-sm text-muted">
          No stories yet. Add them to <span className="font-mono text-foreground">data/news.json</span>, then run{' '}
          <span className="font-mono text-foreground">npm run fetch:news</span> to pull the images.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">AI News Roundup</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{windowLabel(range)}</div>
          </div>
          <div className="text-xs text-muted num">{allItems.length} stories · {liveThemes.length} themes</div>
        </div>

        {stale && (
          <div className="mt-4 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-foreground">
            This roundup is <span className="font-semibold">{stale} old</span>. Refresh{' '}
            <span className="font-mono">data/news.json</span> and run{' '}
            <span className="font-mono">npm run fetch:news</span>.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {liveThemes.map(([key, theme]) => (
            <div key={key} className="border-l-2 border-foreground pl-4 py-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-foreground font-semibold mb-1">{CATEGORY_LABEL[key] || key}</div>
              <div className="text-muted leading-relaxed">{theme}</div>
            </div>
          ))}
        </div>

        {/* Area 6.6 — the filter row follows you down a long grid. */}
        <div className="mt-6 sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/90 backdrop-blur border-b border-border flex flex-wrap items-center gap-3 no-print">
          <div className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label className="sr-only" htmlFor="news-search">Search stories</label>
            <input
              id="news-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stories…"
              className="w-full bg-pill border border-border rounded-full pl-7 pr-7 py-1.5 text-xs text-foreground focus:border-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div ref={chipsRef} onKeyDown={onChipsKeyDown} className="flex gap-2 flex-wrap" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c.key}
              data-chip
              onClick={() => setFilter(c.key)}
              aria-pressed={filter === c.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === c.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
              }`}
            >
              {c.label} <span className="num ml-1">{c.count}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card card-pad text-sm text-muted">
          {q ? <>Nothing matches “{query}”.</> : 'No stories in this category.'}{' '}
          <button
            onClick={() => { setFilter('all'); setQuery(''); }}
            className="text-foreground font-medium underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted mb-6 num" aria-live="polite">
            Showing {items.length} of {sorted.length} stories
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const HERO_CLASS =
  'relative aspect-video overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1';

// Module scope, not inside NewsCard: a component redefined per render is a new
// type each time, so React tears down and remounts the subtree — which would
// reset NewsImage's `failed` state and re-fetch the <img> on every filter click.
// A story with no usable source still renders, it just isn't clickable.
function Hero({ href, children }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${HERO_CLASS} block`}>
      {children}
    </a>
  ) : (
    <div className={HERO_CLASS}>{children}</div>
  );
}

// Humanise an unknown category rather than mislabelling it "Global".
function badgeLabel(category) {
  const key = category || 'global';
  return CARD_BADGE[key] || key.replace(/[-_]/g, ' ');
}

function NewsCard({ item }) {
  const sources = Array.isArray(item.sources) ? item.sources.filter((s) => s && s.url) : [];
  const primary = sources[0];
  const parsed = item.date ? new Date(`${item.date}T12:00:00`) : null;
  const date = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

  return (
    <article className="group flex flex-col">
      <Hero href={primary?.url}>
        <NewsImage src={item.image} alt="" />
        <span className="absolute right-4 top-4 scrim-badge rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider">
          {badgeLabel(item.category)}
        </span>
        <span className="absolute left-4 top-4 scrim-badge rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider num">
          #{item.n}
        </span>
        {date && (
          <span className="absolute right-4 bottom-4 scrim-badge rounded-full px-2.5 py-1 text-[10px] font-medium num">
            {date}
          </span>
        )}
      </Hero>

      <div className="mt-4 flex flex-col">
        <h3 className="text-base font-semibold leading-snug tracking-tight">
          {primary ? (
            <a href={primary.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">{item.title}</a>
          ) : (
            item.title
          )}
        </h3>
        {item.subtitle && <p className="text-xs text-muted mt-1">{item.subtitle}</p>}

        {/* Area 6.5 */}
        <p className="mt-2 text-[11px] text-muted num">
          {readingMinutes(item)} min read · {sources.length} source{sources.length === 1 ? '' : 's'}
        </p>

        <p className="text-sm text-muted mt-2 leading-relaxed">{item.summary}</p>

        {/* Area 6.4 — the analysis roughly doubled every card's height, which
            made the grid impossible to scan. Folded by default, one click open. */}
        {(item.whyItMatters || item.whyForUs) && (
          <details className="mt-3 group/details">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground hover:underline underline-offset-2">
              <ChevronDown size={12} strokeWidth={2.4} className="transition-transform group-open/details:rotate-180" aria-hidden="true" />
              Why it matters
            </summary>
            <div className="mt-3 space-y-3 border-l-2 border-border pl-3">
              {item.whyItMatters && <p className="text-sm text-muted leading-relaxed">{item.whyItMatters}</p>}
              {item.whyForUs && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">For us in Copenhagen</div>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{item.whyForUs}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted">Sources:</span>
          {sources.map((s, i) => (
            <span key={`${s.url}-${i}`} className="flex items-center gap-1">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                {s.name}
                {/* Area 6.8 — say that the link leaves the site. */}
                <ExternalLink size={10} strokeWidth={2.2} className="text-muted" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {i < sources.length - 1 && <span className="text-border">·</span>}
            </span>
          ))}
        </div>
        )}
      </div>
    </article>
  );
}
