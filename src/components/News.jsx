import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Search, X, ArrowUpRight } from 'lucide-react';
import news from '../../data/news.json';

// Roughly how long the expanded card takes to read, at 200 words a minute. Only
// the prose counts; a headline and a source name are not what you settle in to read.
function readingMinutes(item) {
  const words = [item.summary, item.whyItMatters, item.whyForUs]
    .filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Everything a search should look at. Source names included, so "TechCrunch"
// finds the stories it reported.
const haystack = (item) => [
  item.title, item.subtitle, item.summary, item.whyItMatters, item.whyForUs,
  ...(item.sources || []).map((x) => x.name),
].filter(Boolean).join(' ').toLowerCase();

function NewsImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">no image</div>;
  }
  return (
    <>
    {/* A skeleton holds the box and the image fades over it, so a slow
        image settles in rather than flashing empty grey.
        NOT a true LQIP blur-up: that needs a per-image base64 thumbnail
        emitted at build time, a new generated artifact and a pipeline step
        for a difference you would struggle to see at this card size. */}
    {!loaded && <div className="absolute inset-0 skeleton rounded-2xl" aria-hidden="true" />}
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      /* Intrinsic ratio so the card reserves its box before the file lands,
         instead of the grid reflowing as each image arrives. */
      width={640}
      height={360}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
    </>
  );
}

// "europe" is the current category; "eu-policy" is the older label, still matched
// so previously-curated items keep showing until the news is regenerated.
const isEurope = (c) => c === 'europe' || c === 'eu-policy';

const CATEGORIES = [
  { key: 'all',    label: 'All',    count: news.items.length },
  { key: 'global', label: 'Global', count: news.items.filter((i) => i.category === 'global').length },
  { key: 'europe', label: 'Europe', count: news.items.filter((i) => isEurope(i.category)).length },
];

const CATEGORY_LABEL = {
  global: 'Global',
  europe: 'Europe',
  'eu-policy': 'Europe',
};

const CARD_BADGE = {
  global: 'Global',
  europe: 'Europe',
  'eu-policy': 'Europe',
};

// Newest first. data/news.json is written by the drafting pipeline in whatever
// order the sources came back, so file order is not chronological, without this
// the roundup shows an arbitrary item first. Sorted on a copy; `news` is an
// imported module object and must not be mutated.
const byNewest = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

export default function News() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const chipRefs = useRef([]);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = news.items
      .filter((i) => (filter === 'all' ? true : filter === 'europe' ? isEurope(i.category) : i.category === filter))
      .filter((i) => (q ? haystack(i).includes(q) : true));
    return [...list].sort(byNewest);
  }, [filter, query]);

  // Arrow keys walk the filter chips with one tab stop for the set. They are a
  // single-choice control, so moving also selects, the way a radio group does.
  function onChipKeyDown(e, index) {
    const n = CATEGORIES.length;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setFilter(CATEGORIES[next].key);
    chipRefs.current[next]?.focus();
  }

  const curated = news.curatedAt
      ? new Date(news.curatedAt + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="h-section">AI News Roundup</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{news.windowLabel}</h1>
          </div>
          <div className="text-xs text-muted text-right">
            <div>{news.items.length} stories · {Object.keys(news.themes).length} themes</div>
            {curated && <div className="mt-0.5">Last reviewed {curated}</div>}
          </div>
        </div>

        {/* Planned: auto-refresh this roundup on a schedule instead of by hand. */}
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-pill px-4 py-3 text-sm">
          <Clock size={15} strokeWidth={2} className="text-foreground mt-0.5 flex-shrink-0" />
          <p className="text-muted">
            <span className="font-medium text-foreground">Coming soon: this updates itself.</span>{' '}
            We're setting up a job that gathers the relevant AI stories automatically every 1–2 weeks (cadence still to be decided), so the roundup stays fresh without manual updates.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {Object.entries(news.themes).map(([key, theme]) => (
            <div key={key} className="border-l-2 border-foreground pl-4 py-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-foreground font-semibold mb-1">{CATEGORY_LABEL[key]}</div>
              <div className="text-muted leading-relaxed">{theme}</div>
            </div>
          ))}
        </div>

        {/* Sticky under the 56px header, so filters and search stay reachable
            while scrolling twelve cards. */}
        <div className="sticky top-14 z-20 -mx-4 mt-6 border-b border-border bg-[var(--page)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Filter stories by region" className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c, i) => (
                <button
                  key={c.key}
                  ref={(el) => { chipRefs.current[i] = el; }}
                  onClick={() => setFilter(c.key)}
                  onKeyDown={(e) => onChipKeyDown(e, i)}
                  tabIndex={filter === c.key ? 0 : -1}
                  aria-pressed={filter === c.key}
                  className={`tap-target rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === c.key
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                  }`}
                >
                  {c.label} <span className="ml-1">{c.count}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <label htmlFor="news-search" className="sr-only">Search the roundup</label>
              <input
                id="news-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories"
                className="w-full bg-background border border-border rounded-full pl-9 pr-9 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <p aria-live="polite" className="sr-only">
            {query ? `${items.length} of ${news.items.length} stories match ${query}.` : ''}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card card-pad text-sm text-muted">
          {query
            ? <>Nothing matches “{query}”. <button type="button" onClick={() => setQuery('')} className="underline underline-offset-2">Clear the search</button>.</>
            : 'No stories in this category.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }) {
  const [open, setOpen] = useState(false);
  const primary = item.sources[0];
  const date = new Date(item.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const hasMore = item.summary || item.whyItMatters || item.whyForUs;

  return (
    <article className="group flex flex-col">
      <a
        href={primary.url}
        target="_blank"
        rel="noreferrer"
        className="relative aspect-video overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        <NewsImage src={item.image} alt="" />
        <span className="absolute right-4 top-4 rounded-full chip-on-media px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider">
          {CARD_BADGE[item.category] || 'Global'}
        </span>
        <span className="absolute left-4 top-4 rounded-full chip-on-media px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ">
          #{item.n}
        </span>
        <span className="absolute right-4 bottom-4 rounded-full chip-on-media px-2.5 py-1 text-[10px] font-medium ">
          {date}
        </span>
      </a>

      <div className="mt-4 flex flex-col">
        <h2 className="text-base font-semibold leading-snug tracking-tight">
          <a href={primary.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
            {item.title}
            <ArrowUpRight size={13} className="inline-block -mt-1 ml-0.5 text-muted" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h2>
        {item.subtitle && <p className="text-xs text-muted mt-1 leading-relaxed">{item.subtitle}</p>}

        {open && (
          <div className="mt-3 space-y-2.5">
            {item.summary && <p className="text-sm text-muted leading-relaxed">{item.summary}</p>}
            {item.whyItMatters && (
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">Why it matters. </span>
                <span className="text-muted">{item.whyItMatters}</span>
              </p>
            )}
            {item.whyForUs && (
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">For us in Copenhagen. </span>
                <span className="text-muted">{item.whyForUs}</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          {hasMore ? (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="tap-target inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-muted transition-colors"
            >
              {open ? 'Show less' : 'Read more'}
              <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
          ) : <span />}
          {hasMore && (
            <span className="flex items-center gap-1 text-[11px] text-muted flex-shrink-0">
              <Clock size={11} aria-hidden="true" />
              {readingMinutes(item)} min
              {/* Explicit spaces: JSX drops whitespace between elements, so without
                  these it renders as "1 min·2 sources". */}
              {' '}<span aria-hidden="true">·</span>{' '}
              {item.sources.length} {item.sources.length === 1 ? 'source' : 'sources'}
            </span>
          )}
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs min-w-0">
            {item.sources.map((s, i) => (
              <span key={`${s.url}-${i}`} className="flex items-center gap-1">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tap-target text-muted hover:text-foreground hover:underline underline-offset-2 truncate"
                >
                  {s.name}
                  <ArrowUpRight size={11} className="inline-block -mt-0.5 ml-0.5" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {i < item.sources.length - 1 && <span className="text-border">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
