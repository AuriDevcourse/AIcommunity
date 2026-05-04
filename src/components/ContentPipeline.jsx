import { fmtDate } from '../lib/dates.js';

const STAGES = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'aiDraft',    label: 'AI draft' },
  { key: 'edited',     label: 'Edited' },
  { key: 'posted',     label: 'Posted' },
];

export default function ContentPipeline({ sessions }) {
  const recent = [...sessions].slice(-3).reverse();

  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Content pipeline</div>
        <div className="text-xs text-muted">WhatsApp recap · LinkedIn post</div>
      </div>

      {recent.length === 0 ? (
        <div className="mt-4 text-sm text-muted">No sessions yet.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {recent.map((s) => {
            const captured = (s.summary && s.summary.length > 20) || s.demos.length > 0;
            const state = {
              transcript: captured,
              aiDraft: false,
              edited: false,
              posted: false,
            };
            return (
              <div key={s.number} className="border border-border rounded-lg p-3 bg-pill">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">#{s.number} · {fmtDate(s.date)}</div>
                  <div className="text-[11px] text-muted num">{s.demos.length} demo{s.demos.length === 1 ? '' : 's'}</div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {STAGES.map((stage, i) => {
                    const on = state[stage.key];
                    return (
                      <div key={stage.key} className="flex items-center gap-1.5 flex-1">
                        <div className={`h-1.5 flex-1 rounded-full ${on ? 'bg-ok/70' : 'bg-border'}`} />
                        {i < STAGES.length - 1 && <div className="w-1" />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted">
                  {STAGES.map((stage) => (
                    <span key={stage.key}>{stage.label}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-[11px] text-muted leading-relaxed">
        Phase 2: wire Granola → auto-fill transcript &amp; AI draft. Statuses above are placeholders.
      </div>
    </div>
  );
}
