import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Sparkles, ArrowRight } from 'lucide-react';

// Cockpit preview of the Forum's "Ideas" board: shows the top-voted ideas and
// links into the forum to add one, vote, or reply. The source of truth is the
// shared threads engine on the `ideas` channel (see Discussions.jsx).
const IDEAS_CHANNEL = 'ideas';
const TOP_N = 5;

export default function Suggestions({ onOpenForum }) {
  const [ideas, setIdeas] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/threads?key=${encodeURIComponent(IDEAS_CHANNEL)}`);
      const j = await r.json();
      const roots = (j.comments || [])
        .filter((c) => !c.parentId)
        .sort((a, b) => (b.score - a.score) || (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, TOP_N);
      setIdeas(roots);
    } catch {
      setIdeas([]);
    }
  }, []);
  // Refresh so the cockpit preview tracks votes/posts made over in the forum.
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(id);
  }, [load]);

  const openIdeas = () => onOpenForum?.(IDEAS_CHANNEL);

  return (
    <section className="h-full warm-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
        <Lightbulb size={12} strokeWidth={2} />
        <span>Top ideas</span>
      </h2>
      <p className="mt-2 text-sm text-muted leading-relaxed">What the community wants to build next.</p>

      <ul className="mt-4 space-y-2">
        {ideas === null && Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
            <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3.5 w-full" />
            </div>
          </li>
        ))}

        {ideas?.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-5 text-center">
            <Lightbulb size={18} strokeWidth={2} className="mx-auto text-muted" />
            <p className="mt-2 text-xs text-muted">No ideas yet. Be the first to suggest one.</p>
          </li>
        )}

        {ideas?.map((s, idx) => {
          const top = idx === 0 && s.score > 0;
          return (
            <li
              key={s.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${top ? 'top-idea-card' : 'bg-background border-border'}`}
            >
              <span className={`grid place-items-center min-w-7 h-7 px-1.5 rounded-lg text-sm font-semibold num tabular-nums flex-shrink-0 ${top ? 'ideas-chip' : 'bg-accent text-muted'}`}>
                {s.score}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>by {s.name}</span>
                  {top && <span className="pill-top"><Sparkles size={11} strokeWidth={2.4} /> top idea</span>}
                </div>
                <p className="mt-1 text-sm leading-snug line-clamp-2">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={openIdeas}
        className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background text-foreground py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        Add or discuss ideas <ArrowRight size={15} strokeWidth={2.2} />
      </button>
    </section>
  );
}
