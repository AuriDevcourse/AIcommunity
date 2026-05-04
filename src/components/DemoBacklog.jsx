export default function DemoBacklog({ backlog, members }) {
  const byStatus = (s) => backlog.filter((b) => b.status === s);
  const queued = byStatus('queued');
  const proposed = byStatus('proposed');

  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Demo backlog</div>
        <div className="text-xs text-muted num">{backlog.length} total</div>
      </div>

      {backlog.length === 0 ? (
        <div className="mt-4 text-sm text-muted leading-relaxed">
          Empty for now.
          <div className="mt-3 text-muted text-xs">
            Add an entry to <span className="font-mono text-foreground">data/backlog.json</span>:
            <pre className="mt-2 bg-accent border border-border rounded-md p-2 text-[11px] overflow-x-auto text-foreground">{`{
  "member": "Sany",
  "topic": "Programming basics",
  "status": "proposed",
  "ready": "needs time"
}`}</pre>
          </div>
          <div className="mt-3 text-muted text-xs">
            <span className="font-semibold text-foreground">Statuses:</span> proposed · queued · demoed
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {queued.length > 0 && <BacklogGroup label="Queued" items={queued} accent />}
          {proposed.length > 0 && <BacklogGroup label="Proposed" items={proposed} />}
        </div>
      )}
    </div>
  );
}

function BacklogGroup({ label, items, accent }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted mb-1">{label}</div>
      <div className="space-y-1.5">
        {items.map((b, i) => (
          <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-md border ${accent ? 'border-foreground bg-accent' : 'border-border bg-pill'}`}>
            <div className="flex-1">
              <div className="font-medium text-foreground">{b.member}</div>
              <div className="text-muted text-xs">{b.topic}</div>
            </div>
            {b.ready && <span className="pill pill-mute text-[10px]">{b.ready}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
