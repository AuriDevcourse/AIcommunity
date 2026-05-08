import { useState } from 'react';
import news from '../../data/news.json';

const CATEGORIES = [
  { key: 'all',       label: 'All',           count: news.items.length },
  { key: 'global',    label: 'Global',        count: news.items.filter((i) => i.category === 'global').length },
  { key: 'eu-policy', label: 'EU / Policy',   count: news.items.filter((i) => i.category === 'eu-policy').length },
];

const CATEGORY_LABEL = {
  global: 'Global',
  'eu-policy': 'EU / Denmark / Policy',
};

export default function News() {
  const [filter, setFilter] = useState('all');
  const items = filter === 'all' ? news.items : news.items.filter((i) => i.category === filter);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">AI News Roundup</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{news.windowLabel}</div>
          </div>
          <div className="text-xs text-muted num">{news.items.length} stories · {Object.keys(news.themes).length} themes</div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {Object.entries(news.themes).map(([key, theme]) => (
            <div key={key} className="border-l-2 border-foreground pl-4 py-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-foreground font-semibold mb-1">{CATEGORY_LABEL[key]}</div>
              <div className="text-muted leading-relaxed">{theme}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === c.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
              }`}
            >
              {c.label} <span className="num opacity-70 ml-1">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function NewsCard({ item }) {
  const primary = item.sources[0];
  const date = new Date(item.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <article className="group flex flex-col">
      <a
        href={primary.url}
        target="_blank"
        rel="noreferrer"
        className="relative aspect-video overflow-hidden rounded-2xl bg-accent transition-transform duration-300 ease-out group-hover:-translate-y-1"
      >
        {item.image ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">no image</div>
        )}
        <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground">
          {item.category === 'eu-policy' ? 'EU / Policy' : 'Global'}
        </span>
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground num">
          #{item.n}
        </span>
        <span className="absolute right-4 bottom-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium num text-foreground">
          {date}
        </span>
      </a>

      <div className="mt-4 flex flex-col">
        <h3 className="text-base font-semibold leading-snug tracking-tight">
          <a href={primary.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">{item.title}</a>
        </h3>
        {item.subtitle && <p className="text-xs text-muted mt-1">{item.subtitle}</p>}
        <p className="text-sm text-muted mt-2 leading-relaxed">{item.summary}</p>

        {(item.whyItMatters || item.whyForUs) && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            {item.whyItMatters && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">Why it matters</div>
                <p className="mt-1 text-sm text-muted leading-relaxed">{item.whyItMatters}</p>
              </div>
            )}
            {item.whyForUs && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">For us in Copenhagen</div>
                <p className="mt-1 text-sm text-muted leading-relaxed">{item.whyForUs}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted">Sources:</span>
          {item.sources.map((s, i) => (
            <span key={s.url} className="flex items-center gap-1">
              <a href={s.url} target="_blank" rel="noreferrer" className="text-foreground hover:underline underline-offset-2">
                {s.name}
              </a>
              {i < item.sources.length - 1 && <span className="text-border">·</span>}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
