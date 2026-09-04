import { Rocket, ArrowUpRight, UserRound } from 'lucide-react';
import projects from '../../data/projects.json';

// Showcase of things the community builds. Each project links out to its live
// site. Add one by dropping an entry in data/projects.json (no code change).
const STATUS_PILL = { live: 'pill-ok', beta: 'pill-warn', wip: 'pill-mute' };
const STATUS_LABEL = { live: 'Live', beta: 'Beta', wip: 'In progress' };

export default function Projects() {
  // Only show projects a visitor can actually open. A page behind a login wall
  // (e.g. a protected deploy) must be marked "public": false in projects.json,
  // browsers cannot detect another site's auth barrier cross-origin, so it is a flag.
  const items = (projects.projects || []).filter((p) => p.public !== false);

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <Rocket size={11} strokeWidth={2.2} />
        <span>Projects</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Things we build</h1>
      <p className="text-sm text-muted mt-1 max-w-2xl">Projects from the AI Sundays community, built one Sunday at a time. Want yours here? Bring it to a session.</p>

      {items.length === 0 ? (
        <div className="card card-pad mt-5 text-sm text-muted text-center">No projects yet. Yours could be the first.</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="warm-card card-interactive p-5 text-left flex flex-col h-full"
            >
              <div className="flex items-center gap-2">
                <span className={`pill ${STATUS_PILL[p.status] || 'pill-mute'}`}>{STATUS_LABEL[p.status] || p.status}</span>
              </div>
              <h2 className="mt-3 text-base font-semibold tracking-tight leading-snug">{p.name}</h2>
              {p.tagline && <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>}
              <p className="mt-2 text-sm text-muted leading-relaxed flex-1">{p.desc}</p>
              {p.by && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
                  <UserRound size={12} strokeWidth={2} /> Built by {p.by}
                </span>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="flex flex-wrap gap-1.5 min-w-0">
                  {(p.tags || []).map((t) => <span key={t} className="text-[11px] text-muted">#{t}</span>)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold flex-none">
                  {p.cta || 'Open'} <ArrowUpRight size={13} strokeWidth={2.5} />
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
