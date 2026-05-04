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
    <div className="space-y-6">
      <div className="card card-pad">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="h-section">AI News Roundup</div>
            <div className="text-xl font-semibold mt-1">{news.windowLabel}</div>
          </div>
          <div className="text-xs text-ink-400 num">{news.items.length} stories · {Object.keys(news.themes).length} themes</div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {Object.entries(news.themes).map(([key, theme]) => (
            <div key={key} className="border-l-2 border-accent/50 pl-3 py-1">
              <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">{CATEGORY_LABEL[key]}</div>
              <div className="text-ink-200 italic">{theme}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                filter === c.key
                  ? 'bg-accent text-ink-950 border-accent'
                  : 'bg-ink-800/60 text-ink-300 border-ink-700 hover:border-ink-600'
              }`}
            >
              {c.label} <span className="num opacity-70 ml-1">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
    <article className="card overflow-hidden flex flex-col group">
      <a href={primary.url} target="_blank" rel="noreferrer" className="block relative aspect-[16/9] bg-ink-800 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-500 text-xs">no image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="num text-[10px] bg-ink-950/80 text-ink-200 px-1.5 py-0.5 rounded border border-ink-700">#{item.n}</span>
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            item.category === 'eu-policy' ? 'bg-accent/20 text-accent border-accent/40' : 'bg-ink-950/80 text-ink-300 border-ink-700'
          }`}>{item.category === 'eu-policy' ? 'EU / Policy' : 'Global'}</span>
        </div>
        <div className="absolute bottom-2 right-2 num text-[10px] text-ink-200 bg-ink-950/80 px-1.5 py-0.5 rounded border border-ink-700">{date}</div>
      </a>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-base font-semibold leading-snug">
          <a href={primary.url} target="_blank" rel="noreferrer" className="hover:text-accent transition">{item.title}</a>
        </h3>
        {item.subtitle && <p className="text-xs text-ink-400 mt-1">{item.subtitle}</p>}
        <p className="text-sm text-ink-300 mt-2 leading-relaxed flex-1">{item.summary}</p>

        <div className="mt-3 pt-3 border-t border-ink-800 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-ink-500">Sources:</span>
          {item.sources.map((s, i) => (
            <span key={s.url} className="flex items-center gap-1">
              <a href={s.url} target="_blank" rel="noreferrer" className="text-ink-300 hover:text-accent transition underline-offset-2 hover:underline">
                {s.name}
              </a>
              {i < item.sources.length - 1 && <span className="text-ink-700">·</span>}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
