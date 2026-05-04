export default function ActionItems({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="card card-pad h-full">
        <div className="h-section">Open action items</div>
        <div className="mt-3 text-sm text-muted">All clear.</div>
      </div>
    );
  }
  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Open action items</div>
        <div className="text-xs text-muted num">{actions.length}</div>
      </div>
      <ul className="mt-3 space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {actions.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1 w-3 h-3 rounded border border-border inline-block flex-shrink-0" />
            <div className="flex-1">
              <div className="text-foreground">{a.text}</div>
              <div className="text-[11px] text-muted mt-0.5">from {a.source}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
