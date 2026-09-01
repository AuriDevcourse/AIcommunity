import { useEffect, useState } from 'react';
import { MessagesSquare, ChevronRight } from 'lucide-react';

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Compact cockpit preview of the newest forum topics. Clicking one opens it in
// the Forum tab (via onOpenForum). The full conversation lives in the Forum.
export default function LatestDiscussion({ onOpenForum }) {
  const [topics, setTopics] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/topics')
      .then((r) => r.json())
      .then((j) => { if (alive) setTopics(j.topics || []); })
      .catch(() => { if (alive) setTopics([]); });
    return () => { alive = false; };
  }, []);

  const top = (topics || []).slice(0, 4);

  return (
    <section className="h-full warm-card p-5 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 h-section">
          <MessagesSquare size={11} strokeWidth={2.2} />
          <span>Latest discussion</span>
        </h2>
        <button
          onClick={() => onOpenForum?.()}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
        >
          Open forum <ChevronRight size={13} />
        </button>
      </div>

      <div className="mt-3 flex-1">
        {topics === null && (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-1">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="skeleton h-2.5 w-24 mt-1.5" />
              </div>
            ))}
          </div>
        )}

        {topics !== null && top.length === 0 && (
          <button
            onClick={() => onOpenForum?.()}
            className="w-full text-left text-sm text-muted hover:text-foreground transition-colors py-2"
          >
            No discussions yet. Start the first topic in the Forum.
          </button>
        )}

        <ul className="divide-y divide-border">
          {top.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onOpenForum?.(t.id)}
                className="group w-full text-left flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium tracking-tight truncate group-hover:underline underline-offset-2">{t.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">by {t.createdBy} · {timeAgo(t.createdAt)}</div>
                </div>
                <ChevronRight size={15} className="flex-shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
