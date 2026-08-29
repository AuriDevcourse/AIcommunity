import { fmtDateLong } from '../lib/dates.js';

// Area 1.2 — the page previously just stopped. A footer gives the dashboard an
// identity, states how fresh the data is, and is where a newcomer looks for
// "what is this and who runs it".
export default function Footer({ generatedAt, sessionCount, memberCount }) {
  const built = generatedAt ? new Date(generatedAt) : null;
  const builtIso = built && !Number.isNaN(built.getTime()) ? built.toISOString().slice(0, 10) : null;

  return (
    <footer className="no-print border-t border-border mt-12">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">AI Workshop · Copenhagen</div>
          <p className="mt-1 text-xs text-muted">
            {sessionCount} sessions and {memberCount} members so far. Every second Sunday, 12:30–14:30.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          {builtIso && (
            <span>
              Data built{' '}
              <time dateTime={builtIso} className="num text-foreground">
                {fmtDateLong(builtIso)}
              </time>
            </span>
          )}
          <a
            href="https://github.com/AuriDevcourse/AIcommunity"
            target="_blank"
            rel="noreferrer"
            className="text-foreground hover:underline underline-offset-2"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
