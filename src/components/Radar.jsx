import { useMemo, useRef, useState } from 'react';
import {
  Radar as RadarIcon, Search, X, ChevronDown, ArrowUpRight, TrendingUp, TrendingDown,
  Minus, Sparkles, Eye, ShieldQuestion, Clock, LayoutGrid, Columns3, Check, Plus,
  Terminal, BookOpen, Coins, GitBranch, Globe,
  FileSearch, ListChecks, PencilLine, Play, Repeat, Cpu, Plug, Briefcase,
  Building2, MapPin, Banknote, Compass, Lightbulb, HelpCircle,
} from 'lucide-react';
import radar from '../../data/radar.json';
import { TODAY } from '../lib/dates.js';

// The Radar is hand-curated on a roughly monthly cycle, so "old" starts at five
// weeks: past that the window it describes has closed and prices have almost
// certainly moved. Same honesty contract as the News tab, for the same reason.
const STALE_AFTER_DAYS = 35;

// Up to four columns fit a comparison table before the first column stops being
// readable on a laptop. This is a layout limit, not an arbitrary one.
const MAX_COMPARE = 4;

const CAT = Object.fromEntries(radar.categories.map((c) => [c.key, c]));

// What a price band means in one word, plus which pill colour carries it.
// `byo` is its own band because "free tool, metered model" is neither free nor
// priced, and collapsing it into either one misleads somebody's budget.
const BANDS = {
  free: { label: 'Free',               pill: 'pill-ok'   },
  byo:  { label: 'Bring your own key', pill: 'pill-acc'  },
  low:  { label: 'Low',                pill: 'pill-ok'   },
  mid:  { label: 'Subscription',       pill: 'pill-warn' },
  high: { label: 'Metered, adds up',   pill: 'pill-warn' },
};

const LINK_ICON = { site: Globe, docs: BookOpen, repo: GitBranch, pricing: Coins, read: BookOpen };

// One glyph per category, used for the card thumbnail. A category mark rather
// than a company logo: logos are somebody else's trademark, and reproducing ten
// of them on an editorial page is a licensing question we do not need to have.
const CAT_GLYPH = { agents: Terminal, models: Cpu, build: Plug, work: Briefcase };

// The five steps of the agent loop, named as strings in the JSON so the copy can
// be edited without touching the component.
const STEP_ICON = { search: FileSearch, list: ListChecks, pencil: PencilLine, play: Play, repeat: Repeat };

// The three lines at the top: what moved, what it will cost, what to try.
const HEADLINE_ICON = { changed: TrendingUp, cost: Coins, try: Sparkles };

// Everything a search should reach. The non-obvious fields are included on
// purpose: "context window" or "prompt caching" only appears in `hidden` and
// `watch`, and those are the paragraphs somebody is actually hunting for. The
// origin block is in here too, so searching an investor ("Menlo", "Index") or a
// city ("London") finds the entry, which is half the reason that block exists.
const haystack = (i) => [
  i.name, i.maker, i.tagline, i.talkingPoint, i.what, i.hidden, i.peek, i.watch, i.bestFor,
  i.surface, i.cost?.headline, i.cost?.detail, CAT[i.category]?.label,
  i.origin?.builtBy, i.origin?.people, i.origin?.based, i.origin?.started,
  i.origin?.money, i.origin?.next, i.origin?.edge,
  ...(i.origin?.rounds || []).flatMap((r) => [r.round, r.amount, r.valuation, r.investors]),
].filter(Boolean).join(' ').toLowerCase();

/** Cheap deterministic hash, so an entry's thumbnail pattern never changes. */
function hash(s) {
  let h = 2166136261;
  for (let n = 0; n < s.length; n += 1) {
    h ^= s.charCodeAt(n);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The card thumbnail. The real brand mark when we have one, downloaded to
 * `public/radar/` by `scripts/fetch-radar-logos.mjs` because the site's CSP is
 * `img-src 'self'` and a hotlinked logo would be blocked without a word.
 *
 * The generated fallback is a category glyph over a dot grid seeded from the
 * entry id. It is what the thematic entries use permanently: "the frontier price
 * war" has no logo, and inventing one for it would be a small lie. Anything at
 * 85+ momentum gets the gold wash, the only place on a card where the score
 * shows up as colour.
 *
 * Marks identify the thing being written about. They never sit on a button or a
 * badge, where they would read as endorsement.
 */
function Sigil({ item, size = 44 }) {
  const [broken, setBroken] = useState(false);
  const Glyph = CAT_GLYPH[item.category] || Terminal;
  const seed = hash(item.id);
  const hot = item.momentum >= 85;
  const dots = Array.from({ length: 16 }, (_, n) => (seed >> n) & 1);
  const logo = item.logo && !broken;

  return (
    <span
      aria-hidden="true"
      className="relative flex-shrink-0 grid place-items-center rounded-xl border border-border overflow-hidden"
      style={{
        width: size,
        height: size,
        // A real mark sits on brand cream in both themes. Almost every favicon
        // and webclip is drawn for a light background, so on the dark theme's
        // pill a black-on-transparent logo (Cursor, OpenCode) reads as a smudge.
        // Only the generated glyph, which we control, takes the gold wash.
        background: logo
          ? 'var(--brand-cream)'
          : hot
            ? 'linear-gradient(135deg, var(--gold-chip-b), var(--gold-chip-a))'
            : 'var(--pill)',
      }}
    >
      {logo ? (
        <img
          src={item.logo}
          alt=""
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
          style={{ padding: Math.round(size * 0.16) }}
        />
      ) : (
        <>
          <svg viewBox="0 0 16 16" className="absolute inset-0 h-full w-full opacity-[0.18]">
            {dots.map((on, n) => on ? (
              <circle key={n} cx={(n % 4) * 4 + 2} cy={Math.floor(n / 4) * 4 + 2} r="1" fill="currentColor" />
            ) : null)}
          </svg>
          <Glyph
            size={Math.round(size * 0.42)}
            strokeWidth={1.9}
            className={hot ? 'relative text-[color:var(--gold-chip-fg)]' : 'relative text-foreground'}
          />
        </>
      )}
    </span>
  );
}

const byMomentum = (a, b) => b.momentum - a.momentum;

// The one-line version of the cap table is written by hand in the JSON rather
// than derived from the last funding row. Deriving it produced things like
// "$60B in stock Acquired by SpaceX at $60B", because an acquisition, a
// donation to a foundation and a Series F do not share a sentence shape.

/** Five segments, filled to `score`. A bar chart small enough to sit in a card. */
function Meter({ label, score }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted flex-1 min-w-0 truncate">{label}</span>
      <span className="flex gap-[3px] flex-shrink-0" role="img" aria-label={`${label}: ${score} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            aria-hidden="true"
            className={`h-1.5 w-3 rounded-full ${n <= score ? 'bg-foreground' : 'bg-border'}`}
          />
        ))}
      </span>
    </div>
  );
}

/** Change since the previous review. `new` is a first appearance, not a delta of zero. */
function Delta({ value }) {
  if (value === 'new') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-chip-a)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--gold-chip-fg)]">
        New
      </span>
    );
  }
  if (typeof value !== 'number' || value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted">
        <Minus size={11} strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">Unchanged since the last review</span>
        <span aria-hidden="true">0</span>
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-ok' : 'text-muted'}`}>
      <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
      <span className="num">{up ? '+' : ''}{value}</span>
      <span className="sr-only">since the last review</span>
    </span>
  );
}

/** The horizontal momentum bar, used in the ranking board and the compare table. */
function MomentumBar({ value, muted = false }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-border overflow-hidden" aria-hidden="true">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${value}%`,
          background: muted
            ? 'var(--muted)'
            : 'linear-gradient(90deg, var(--gold-chip-b), var(--gold-chip-a))',
        }}
      />
    </span>
  );
}

function LinkRow({ links }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {links.map((l) => {
        const Icon = LINK_ICON[l.kind] || Globe;
        return (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="tap-target inline-flex items-center gap-1 text-xs text-muted hover:text-foreground hover:underline underline-offset-2"
          >
            <Icon size={12} strokeWidth={2} aria-hidden="true" />
            {l.label}
            <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        );
      })}
    </div>
  );
}

export default function Radar() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('cards');
  const [picked, setPicked] = useState([]); // ordered, so compare columns keep the order you chose
  const chipRefs = useRef([]);

  const chips = useMemo(() => ([
    { key: 'all', label: 'Everything', count: radar.items.length },
    ...radar.categories.map((c) => ({
      key: c.key,
      label: c.label,
      count: radar.items.filter((i) => i.category === c.key).length,
    })),
  ]), []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return radar.items
      .filter((i) => (filter === 'all' ? true : i.category === filter))
      .filter((i) => (q ? haystack(i).includes(q) : true))
      .sort(byMomentum);
  }, [filter, query]);

  // One section per category when the reader has not narrowed anything, a single
  // unlabelled run once they have. `items` is already filtered and ranked, so
  // grouping only reshuffles it into buckets, never changes what is shown.
  const grouped = useMemo(() => {
    const narrowed = filter !== 'all' || query.trim() !== '';
    const keys = narrowed
      ? [...new Set(items.map((i) => i.category))]
      : radar.categories.map((c) => c.key);
    return keys
      .map((key) => ({
        key,
        label: CAT[key]?.label || key,
        blurb: CAT[key]?.blurb,
        look: CAT[key]?.look,
        art: CAT[key]?.art,
        items: items.filter((i) => i.category === key),
      }))
      .filter((g) => g.items.length > 0);
  }, [items, filter, query]);

  const ranked = useMemo(() => [...radar.items].sort(byMomentum), []);
  const compared = picked.map((id) => radar.items.find((i) => i.id === id)).filter(Boolean);

  const toggle = (id) => setPicked((p) => (
    p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? p : [...p, id]
  ));

  // Arrow keys walk the category chips with one tab stop for the set, and moving
  // also selects, the way a radio group does. Copied deliberately from the News
  // tab so the two filter rows on this site behave identically.
  function onChipKeyDown(e, index) {
    const n = chips.length;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setFilter(chips[next].key);
    chipRefs.current[next]?.focus();
  }

  const staleDays = radar.reviewedAt
    ? Math.floor((TODAY - new Date(radar.reviewedAt + 'T12:00:00')) / 86400000)
    : null;
  const reviewed = radar.reviewedAt
    ? new Date(radar.reviewedAt + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-10">
      <header>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-1.5 h-section">
              <RadarIcon size={11} strokeWidth={2.2} aria-hidden="true" />
              <span>Radar</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{radar.windowLabel}</h1>
          </div>
          <div className="text-xs text-muted text-right">
            <div><span className="num">{radar.items.length}</span> things tracked</div>
            {reviewed && <div className="mt-0.5">Last reviewed {reviewed}</div>}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm text-muted leading-relaxed">{radar.standfirst}</p>

        {staleDays !== null && staleDays > STALE_AFTER_DAYS && (
          <div role="status" className="mt-5 flex items-start gap-2.5 rounded-xl bg-warn/10 px-4 py-3 text-sm">
            <Clock size={15} strokeWidth={2} className="text-warn mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-warn">
              <span className="font-medium">This radar is {staleDays} days old.</span>{' '}
              Prices and rankings below have almost certainly moved. Open the source links before you rely on a number.
            </p>
          </div>
        )}
      </header>

      {/* The whole page in three lines. It sits first because the previous
          version opened with 1,180 words of primer before saying a single thing
          that had happened, which is 47% of the default view spent teaching
          somebody who came to find out what changed. */}
      {radar.headline && (
        <section aria-labelledby="radar-headline" className="warm-card p-5 sm:p-6">
          <h2 id="radar-headline" className="h-section">{radar.headline.title}</h2>
          <ul className="mt-4 space-y-3.5">
            {radar.headline.points.map((p) => {
              const Icon = HEADLINE_ICON[p.kind] || Sparkles;
              return (
                <li key={p.kind} className="flex gap-3">
                  <Icon size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold">{p.label}. </span>
                    <span className="text-muted">{p.text}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The editorial read. Three sentences about the shape of the cycle, before
          any individual product, because "what changed" is the thing a member
          cannot get from a pricing page. */}
      <section aria-labelledby="radar-shifts">
        <h2 id="radar-shifts" className="h-section">What actually changed</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {radar.shifts.map((s) => (
            <div key={s.title} className="border-l-2 border-foreground pl-4 py-1">
              <h3 className="text-sm font-semibold tracking-tight leading-snug">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The momentum board. This is the headline visual and also the one place
          the page can most easily lie, so the caption says in plain words that
          the number is a person's opinion rather than a scraped metric. A chart
          that looks like data and is not is worse than no chart. */}
      <section aria-labelledby="radar-board" className="warm-card p-5 sm:p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 id="radar-board" className="h-section">Momentum</h2>
          <p className="text-[11px] text-muted">Hand-scored 0 to 100. An editorial read, not a measurement.</p>
        </div>
        <ol className="mt-4 space-y-2.5">
          {ranked.map((i, n) => {
            const dim = filter !== 'all' && i.category !== filter;
            return (
              <li key={i.id} className={`flex items-center gap-3 transition-opacity ${dim ? 'opacity-35' : ''}`}>
                <span className="num w-5 flex-shrink-0 text-right text-[11px] text-muted">{n + 1}</span>
                <span className="w-32 sm:w-44 flex-shrink-0 truncate text-sm font-medium">{i.name}</span>
                <span className="hidden sm:block w-28 flex-shrink-0 truncate text-[11px] text-muted">{CAT[i.category]?.label}</span>
                <span className="flex-1 min-w-0">
                  <MomentumBar value={i.momentum} muted={dim} />
                </span>
                <span className="num w-8 flex-shrink-0 text-right text-xs font-semibold">{i.momentum}</span>
                <span className="w-14 flex-shrink-0 text-right"><Delta value={i.delta} /></span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The primer moved down here and folds shut. It is reference material that
          barely changes month to month, so a returning reader should not have to
          scroll past it to reach this month's news. */}
      {radar.primer && <Primer primer={radar.primer} />}

      {/* Sticky under the 56px header so the filters, the search and the view
          switch stay reachable while scrolling ten long cards. */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-[var(--page)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Filter by category" className="flex gap-2 flex-wrap">
            {chips.map((c, i) => (
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
                {c.label} <span className="ml-1 num">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label htmlFor="radar-search" className="sr-only">Search the radar</label>
            <input
              id="radar-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search capabilities, costs, caveats"
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

          <div role="group" aria-label="View" className="flex rounded-full border border-border bg-pill p-0.5">
            {[
              { key: 'cards', label: 'Cards', Icon: LayoutGrid },
              { key: 'compare', label: 'Compare', Icon: Columns3 },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`tap-target inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  view === key ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                }`}
              >
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                {label}
                {key === 'compare' && picked.length > 0 && (
                  <span className="num ml-0.5">{picked.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {query ? `${items.length} of ${radar.items.length} entries match ${query}.` : ''}
        </p>
      </div>

      {view === 'compare'
        ? <CompareView compared={compared} picked={picked} onToggle={toggle} />
        : (
          items.length === 0 ? (
            <div className="card card-pad text-sm text-muted">
              {query
                ? <>Nothing matches “{query}”. <button type="button" onClick={() => setQuery('')} className="underline underline-offset-2">Clear the search</button>.</>
                : 'Nothing tracked in this category yet.'}
            </div>
          ) : (
            <>
              {/* Grouped by layer when nothing is filtered, because a flat
                  momentum ranking made the page read as one long list of coding
                  agents with a few odd entries mixed in. Searching or picking a
                  category collapses back to a single flat run, where a heading
                  per group would just be noise. */}
              {grouped.map((g) => (
                <section key={g.key} aria-labelledby={`radar-group-${g.key}`}>
                  {/* A brand-style strip so the four layers are told apart by
                      sight, not only by reading a heading. Decorative, hence
                      empty alt: the heading underneath carries the meaning. */}
                  {g.art && (
                    <img
                      src={g.art}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={2000}
                      height={280}
                      className="mb-4 w-full rounded-xl"
                    />
                  )}
                  <div className="border-t-2 border-foreground pt-3">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <h2 id={`radar-group-${g.key}`} className="text-xl font-semibold tracking-tight">
                        {g.label}
                      </h2>
                      <span className="num text-xs text-muted">
                        {g.items.length} {g.items.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-3xl text-sm text-muted leading-relaxed">{g.blurb}</p>
                    {g.look && (
                      <p className="mt-2 max-w-3xl text-xs leading-relaxed">
                        <ListChecks size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
                        <span className="font-semibold">What to look for. </span>
                        <span className="text-muted">{g.look}</span>
                      </p>
                    )}
                  </div>

                  {/* Column flow rather than a grid. Expanding one card in a two-column
                      grid stretches its whole row, so opening the first entry left a
                      screen and a half of empty cream beside it. Columns let each card
                      take exactly its own height. DOM order stays the ranked order. */}
                  <div className="radar-columns mt-5">
                    {g.items.map((item) => (
                      <Card
                        key={item.id}
                        item={item}
                        selected={picked.includes(item.id)}
                        full={picked.length >= MAX_COMPARE}
                        onToggle={() => toggle(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )
        )}

      {/* The bar only appears once comparing is actually possible. One selected
          thing is not a comparison, so it stays out of the way until two. */}
      {view === 'cards' && picked.length >= 2 && (
        <div className="sticky bottom-4 z-20 flex justify-center" data-print="hide">
          <button
            onClick={() => { setView('compare'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="btn btn-primary shadow-[var(--popover-shadow)]"
          >
            <Columns3 size={15} strokeWidth={2} aria-hidden="true" />
            Compare {picked.length} side by side
          </button>
        </div>
      )}

      <footer className="border-t border-border pt-5 text-xs text-muted leading-relaxed max-w-3xl">
        <p>
          Curated by hand on a monthly cycle, last reviewed {reviewed}. Momentum is one person's read of
          how loud and how adopted something is, scored 0 to 100, not a scraped metric. Prices are a note
          taken on the review date and they move faster than this page does, so the pricing link beside each
          entry is the number that counts. Funding figures come from the reporting linked under each entry
          and are as of that date; private valuations are what was reported at the time, not a market price.
          Nothing here is sponsored and nobody paid to be on the list.
        </p>
      </footer>
    </div>
  );
}

/**
 * The explainer that sits above the list. Most of this page is about coding
 * agents, and half the room has never run one, so the loop diagram is always
 * visible while the longer reference material folds away. Somebody who reads
 * this page every month should not have to scroll past a glossary to reach the
 * board.
 */
function Primer({ primer }) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(null); // 'checklist' | 'glossary' | null

  const panel = (key) => (open === key ? null : key);

  // Shut by default. Open it and it is the same primer as before; leave it shut
  // and the page starts with this month's news instead of a lesson.
  if (!shown) {
    return (
      <section aria-labelledby="radar-primer">
        <button
          type="button"
          id="radar-primer"
          onClick={() => setShown(true)}
          aria-expanded={false}
          className="tap-target flex w-full items-center gap-2.5 rounded-xl border border-border bg-pill px-4 py-3 text-left text-sm transition-colors hover:border-foreground"
        >
          <BookOpen size={15} strokeWidth={2} className="flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">{primer.foldLabel || primer.title}</span>
          <ChevronDown size={15} strokeWidth={2.2} className="ml-auto flex-shrink-0 text-muted" aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="radar-primer" className="warm-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 id="radar-primer" className="h-section">{primer.title}</h2>
        <button
          type="button"
          onClick={() => setShown(false)}
          className="tap-target inline-flex items-center gap-1 text-xs font-semibold hover:text-muted"
        >
          Hide
          <ChevronDown size={13} strokeWidth={2.2} className="rotate-180" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted leading-relaxed">{primer.standfirst}</p>

      {/* The stack, bottom to top. This exists because the page used to read as
          if it were only about coding agents: the agent loop was the first thing
          on it and three of the four categories never got explained. */}
      {primer.stack && (
        <div className="mt-6">
          <h3 className="text-base font-semibold tracking-tight">{primer.stack.title}</h3>
          <p className="mt-1.5 max-w-3xl text-sm text-muted leading-relaxed">{primer.stack.body}</p>

          <ol className="mt-5 space-y-2">
            {[...primer.stack.layers].reverse().map((l) => {
              const cat = CAT[l.category];
              const Glyph = CAT_GLYPH[l.category] || Terminal;
              return (
                <li key={l.category} className="flex gap-3 rounded-xl border border-border p-3.5">
                  <span className="mt-0.5 flex-shrink-0 grid place-items-center rounded-lg border border-border bg-pill h-8 w-8">
                    <Glyph size={15} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold tracking-tight">{cat?.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted font-semibold">{l.role}</span>
                      <span className="num ml-auto text-[11px] text-muted">
                        {radar.items.filter((i) => i.category === l.category).length}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted leading-relaxed">{l.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-6">
        {primer.loop.scope && (
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            {primer.loop.scope}
          </div>
        )}
        <h3 className="mt-1 text-base font-semibold tracking-tight">{primer.loop.title}</h3>
        <p className="mt-1.5 max-w-3xl text-sm text-muted leading-relaxed">{primer.loop.body}</p>

        <ol className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {primer.loop.steps.map((s, n) => {
            const Icon = STEP_ICON[s.icon] || Terminal;
            return (
              <li key={s.label} className="border-t-2 border-foreground pt-3">
                <div className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />
                  <span className="text-sm font-semibold tracking-tight">{s.label}</span>
                  <span className="num ml-auto text-[11px] text-muted">{n + 1}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">{s.detail}</p>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 max-w-3xl border-l-2 border-foreground pl-4 text-sm leading-relaxed">
          {primer.loop.shift}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { key: 'checklist', label: primer.checklist.title, Icon: ListChecks },
          { key: 'glossary', label: primer.glossary.title, Icon: BookOpen },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpen(panel(key))}
            aria-expanded={open === key}
            aria-controls={`radar-primer-${key}`}
            className={`tap-target inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              open === key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
            }`}
          >
            <Icon size={13} strokeWidth={2} aria-hidden="true" />
            {label}
            <ChevronDown
              size={13}
              strokeWidth={2.2}
              className={`transition-transform duration-200 ${open === key ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {open === 'checklist' && (
        <div id="radar-primer-checklist" className="mt-5 border-t border-border pt-5">
          <p className="max-w-3xl text-sm text-muted leading-relaxed">{primer.checklist.body}</p>
          <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {primer.checklist.items.map((c, n) => (
              <li key={c.q} className="flex gap-3">
                <span className="num flex-shrink-0 text-xs text-muted pt-0.5">{n + 1}</span>
                <div>
                  <p className="text-sm font-semibold tracking-tight leading-snug">{c.q}</p>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{c.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {open === 'glossary' && (
        <div id="radar-primer-glossary" className="mt-5 border-t border-border pt-5">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {primer.glossary.terms.map((t) => (
              <div key={t.term}>
                <dt className="text-sm font-semibold tracking-tight">{t.term}</dt>
                <dd className="mt-1 text-xs leading-relaxed">
                  {t.plain}
                  <span className="mt-1 block text-muted">
                    <HelpCircle size={11} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
                    {t.matters}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

/**
 * Who built it, where, on whose money, and where it is going. The funding rows
 * are here because ownership turned out to be a product feature: Cursor was
 * independent in March 2026 and a SpaceX subsidiary by August, and a model
 * provider cut it off two weeks later. A cap table is a leading indicator of
 * what a tool will cost and who it will answer to.
 */
function Origin({ origin }) {
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold">
        <Building2 size={11} strokeWidth={2.2} aria-hidden="true" />
        Who is behind it
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
        <p><span className="font-semibold">Built by. </span><span className="text-muted">{origin.builtBy}</span></p>
        {origin.people && <p><span className="font-semibold">People. </span><span className="text-muted">{origin.people}</span></p>}
        {origin.based && (
          <p>
            <MapPin size={11} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
            <span className="font-semibold">Based. </span><span className="text-muted">{origin.based}</span>
          </p>
        )}
        {origin.started && <p><span className="font-semibold">Started. </span><span className="text-muted">{origin.started}</span></p>}
      </div>

      {origin.rounds?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
            <Banknote size={11} strokeWidth={2.2} aria-hidden="true" />
            The money
          </div>
          <ol className="mt-2.5 space-y-2.5">
            {origin.rounds.map((r) => (
              <li key={`${r.when}-${r.round}`} className="border-l-2 border-border pl-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="num text-[11px] text-muted w-16 flex-shrink-0">{r.when}</span>
                  <span className="text-xs font-semibold">{r.round}</span>
                  {r.amount && <span className="num text-xs">{r.amount}</span>}
                  {r.valuation && (
                    <span className="pill pill-mute">
                      <span className="num">{r.valuation}</span> valuation
                    </span>
                  )}
                </div>
                {r.investors && <p className="mt-1 text-[11px] text-muted leading-relaxed">{r.investors}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
        {origin.money && (
          <p>
            <Coins size={11} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
            <span className="font-semibold">How they make money. </span><span className="text-muted">{origin.money}</span>
          </p>
        )}
        {origin.next && (
          <p>
            <Compass size={11} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
            <span className="font-semibold">Where it is heading. </span><span className="text-muted">{origin.next}</span>
          </p>
        )}
      </div>

      {origin.edge && (
        <div className="border-l-2 border-foreground pl-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold">
            <Lightbulb size={11} strokeWidth={2.2} aria-hidden="true" />
            What the cap table tells you
          </div>
          <p className="mt-1 text-sm leading-relaxed">{origin.edge}</p>
        </div>
      )}

      {origin.sources?.length > 0 && (
        <div className="pt-1">
          <LinkRow links={origin.sources.map((s) => ({ label: s.label, url: s.url, kind: 'read' }))} />
        </div>
      )}
    </div>
  );
}

/**
 * Two densities, driven by `item.tier`.
 *
 * Tier 1 is the lead entry in its section and keeps the full closed card. Tier 2
 * shows a mark, a name, a score and one line: the reason to bring it up. Every
 * word of the old closed card is still there, one click away.
 *
 * The reason for the split: sixteen entries all rendered at the same ~490 words
 * meant nothing was ranked, so the reader had to do the ranking, and that is the
 * work that made the page feel like a wall.
 */
function Card({ item, selected, full, onToggle }) {
  const [open, setOpen] = useState(false);
  const band = BANDS[item.cost.band] || BANDS.mid;
  const panelId = `radar-detail-${item.id}`;
  const lead = item.tier !== 2;

  return (
    <article className={`warm-card ${lead ? 'p-5' : 'p-4'} flex flex-col ${selected ? 'ring-2 ring-[color:var(--foreground)]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Sigil item={item} size={lead ? 44 : 32} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
                {CAT[item.category]?.label}
              </span>
              <Delta value={item.delta} />
            </div>
            <h2 className={`mt-1 font-semibold tracking-tight leading-snug ${lead ? 'text-lg' : 'text-base'}`}>
              {item.name}
            </h2>
            <p className="text-xs text-muted mt-0.5">{item.maker}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            <div className={`num font-semibold leading-none ${lead ? 'text-2xl' : 'text-lg'}`}>{item.momentum}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-1">momentum</div>
          </div>
        </div>
      </div>

      {/* The one line worth saying out loud. It replaced the tagline here because
          "what it is" is answered by the name for most of these, while "why it
          is on the list" was buried three paragraphs down. */}
      <p className="mt-3 text-sm leading-relaxed">{item.talkingPoint || item.tagline}</p>

      {lead && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={`pill ${band.pill}`}>{band.label}</span>
            {item.license && <span className="pill pill-mute">{item.license}</span>}
            {item.runsLocal && <span className="pill pill-mute">Runs locally</span>}
            {item.byoKey && item.cost.band !== 'byo' && <span className="pill pill-mute">Own key optional</span>}
          </div>

          <p className="mt-3 text-xs text-muted leading-relaxed">
            <Coins size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
            {item.cost.headline}
          </p>

          {item.origin && (
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              <Building2 size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
              {item.origin.based}
              {item.origin.summary && <> · {item.origin.summary}</>}
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {item.capabilities.map((c) => <Meter key={c.label} label={c.label} score={c.score} />)}
          </div>
        </>
      )}

      {open && (
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          {/* Everything the compact tier hides, restored in the open state. */}
          {!lead && (
            <>
              <p className="text-sm leading-relaxed">{item.tagline}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`pill ${band.pill}`}>{band.label}</span>
                {item.license && <span className="pill pill-mute">{item.license}</span>}
                {item.runsLocal && <span className="pill pill-mute">Runs locally</span>}
                {item.byoKey && item.cost.band !== 'byo' && <span className="pill pill-mute">Own key optional</span>}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                <Coins size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1" aria-hidden="true" />
                {item.cost.headline}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                {item.capabilities.map((c) => <Meter key={c.label} label={c.label} score={c.score} />)}
              </div>
            </>
          )}
          <Detail icon={Terminal} label="What it actually does" tone="plain">{item.what}</Detail>
          <Detail icon={Eye} label="The part the launch thread left out" tone="edge">{item.hidden}</Detail>
          <Detail icon={Sparkles} label="Sneak peek" tone="plain">{item.peek}</Detail>
          <Detail icon={ShieldQuestion} label="The catch" tone="warn">{item.watch}</Detail>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs">
            <p><span className="font-semibold">Best for. </span><span className="text-muted">{item.bestFor}</span></p>
            <p><span className="font-semibold">Where it runs. </span><span className="text-muted">{item.surface}</span></p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <span className="font-semibold text-foreground">Cost, in detail. </span>{item.cost.detail}
          </p>
          {item.origin && <Origin origin={item.origin} />}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="tap-target inline-flex items-center gap-1 text-xs font-semibold hover:text-muted transition-colors"
        >
          {open ? 'Show less' : 'The full read'}
          <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onToggle}
          disabled={!selected && full}
          aria-pressed={selected}
          className={`tap-target inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            selected
              ? 'bg-foreground text-background border-foreground'
              : 'bg-pill text-muted border-border hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
          title={!selected && full ? `Compare holds ${MAX_COMPARE} at a time` : undefined}
        >
          {selected ? <Check size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
          {selected ? 'In compare' : 'Compare'}
        </button>
      </div>

      {/* The lead card keeps its links visible; on the compact tier they wait
          for the expander, so a closed row really is one line. */}
      {(lead || open) && (
        <div id={panelId} className="mt-4">
          <LinkRow links={item.links} />
        </div>
      )}
    </article>
  );
}

function Detail({ icon: Icon, label, tone, children }) {
  const edge = tone === 'edge' ? 'border-l-2 border-foreground pl-3'
    : tone === 'warn' ? 'border-l-2 border-warn pl-3'
    : '';
  return (
    <div className={edge}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold">
        <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-sm text-muted leading-relaxed">{children}</p>
    </div>
  );
}

// Rows are declared once, so adding an attribute to the comparison means adding
// one line here rather than editing a table body by hand.
const ROWS = [
  { label: 'Why it is on the list', get: (i) => i.talkingPoint },
  { label: 'In one line',   get: (i) => i.tagline },
  { label: 'Category',      get: (i) => CAT[i.category]?.label },
  { label: 'What it costs', get: (i) => i.cost.headline },
  { label: 'Cost, in detail', get: (i) => i.cost.detail, small: true },
  { label: 'Open source',   get: (i) => (i.license ? i.license : 'Closed') },
  { label: 'Runs on your machine', get: (i) => (i.runsLocal ? 'Yes' : 'No') },
  { label: 'Swap the model', get: (i) => (i.byoKey ? 'Yes' : 'No') },
  { label: 'Where it runs', get: (i) => i.surface },
  { label: 'Best for',      get: (i) => i.bestFor },
  { label: 'The catch',     get: (i) => i.watch, small: true },
  { label: 'Who is behind it', get: (i) => i.origin?.builtBy },
  { label: 'Based in',      get: (i) => i.origin?.based },
  { label: 'Money behind it', get: (i) => i.origin?.summary },
  { label: 'Where it is heading', get: (i) => i.origin?.next, small: true },
  { label: 'What the cap table tells you', get: (i) => i.origin?.edge, small: true },
];

function CompareView({ compared, picked, onToggle }) {
  const full = picked.length >= MAX_COMPARE;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="h-section">Pick up to {MAX_COMPARE}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...radar.items].sort(byMomentum).map((i) => {
            const on = picked.includes(i.id);
            return (
              <button
                key={i.id}
                onClick={() => onToggle(i.id)}
                disabled={!on && full}
                aria-pressed={on}
                className={`tap-target rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-pill text-foreground border-border hover:bg-accent disabled:opacity-35 disabled:cursor-not-allowed'
                }`}
              >
                {i.name}
              </button>
            );
          })}
        </div>
      </div>

      {compared.length < 2 ? (
        <div className="empty-state">
          <Columns3 size={22} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted">
            Choose at least two above and they line up side by side: cost, capability, licence, and the catch.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">
              Side-by-side comparison of {compared.map((i) => i.name).join(', ')}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-background border-b border-border px-4 py-3 text-left align-bottom w-40">
                  <span className="sr-only">Attribute</span>
                </th>
                {compared.map((i) => (
                  <th key={i.id} scope="col" className="border-b border-border px-4 py-3 text-left align-bottom min-w-[200px]">
                    <Sigil item={i} size={32} />
                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
                      {CAT[i.category]?.label}
                    </div>
                    <div className="mt-1 text-base font-semibold tracking-tight">{i.name}</div>
                    <div className="text-xs text-muted">{i.maker}</div>
                    <button
                      onClick={() => onToggle(i.id)}
                      className="tap-target mt-2 inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
                    >
                      <X size={11} strokeWidth={2.5} aria-hidden="true" />
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold align-top">
                  Momentum
                </th>
                {compared.map((i) => (
                  <td key={i.id} className="border-b border-border px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <MomentumBar value={i.momentum} />
                      <span className="num text-xs font-semibold flex-shrink-0">{i.momentum}</span>
                    </div>
                    <div className="mt-1.5"><Delta value={i.delta} /></div>
                  </td>
                ))}
              </tr>

              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="sticky left-0 z-10 bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold align-top">
                    {row.label}
                  </th>
                  {compared.map((i) => (
                    <td
                      key={i.id}
                      className={`border-b border-border px-4 py-3 align-top leading-relaxed ${row.small ? 'text-xs text-muted' : 'text-sm'}`}
                    >
                      {row.get(i) || <span className="text-muted">Not applicable</span>}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Capability labels differ per entry, so this row prints each one's
                  own meters rather than pretending they share a fixed set of axes.
                  Forcing four shared axes across a protocol, a model family and a
                  dictation app would invent a comparison that does not exist. */}
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold align-top">
                  Capability read
                </th>
                {compared.map((i) => (
                  <td key={i.id} className="border-b border-border px-4 py-3 align-top">
                    <div className="space-y-1.5">
                      {i.capabilities.map((c) => <Meter key={c.label} label={c.label} score={c.score} />)}
                    </div>
                  </td>
                ))}
              </tr>

              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-background px-4 py-3 text-left text-xs font-semibold align-top">
                  Links
                </th>
                {compared.map((i) => (
                  <td key={i.id} className="px-4 py-3 align-top">
                    <LinkRow links={i.links} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
