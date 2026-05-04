export default function Members({ members, sessions }) {
  // Compute last attended (best-effort name match)
  const lastSeen = new Map();
  const lastDemoed = new Map();
  for (const s of sessions) {
    for (const a of s.attendees) {
      const key = a.toLowerCase();
      if (!lastSeen.has(key) || lastSeen.get(key).date < s.date) {
        lastSeen.set(key, { number: s.number, date: s.date });
      }
    }
    for (const d of s.demos) {
      const key = d.presenter.toLowerCase();
      if (!lastDemoed.has(key) || lastDemoed.get(key).date < s.date) {
        lastDemoed.set(key, { number: s.number, date: s.date });
      }
    }
  }

  const matchKey = (name) => {
    const first = name.toLowerCase().split(/\s+/)[0];
    for (const k of lastSeen.keys()) if (k.startsWith(first)) return k;
    return null;
  };

  const enriched = members.map((m) => {
    const k = matchKey(m.name);
    return {
      ...m,
      lastSeen: k ? lastSeen.get(k) : null,
      lastDemoed: k ? lastDemoed.get(k) : null,
    };
  });

  const active = enriched.filter((m) => m.status === 'Active').length;

  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Members</div>
        <div className="text-xs text-ink-400 num">{active} active · {members.length} total</div>
      </div>

      <div className="mt-3 max-h-[320px] overflow-y-auto pr-1">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-500">
            <tr className="text-left">
              <th className="py-1.5 font-medium">Name</th>
              <th className="py-1.5 font-medium">Seen</th>
              <th className="py-1.5 font-medium">Demo</th>
              <th className="py-1.5 font-medium">Building</th>
              <th className="py-1.5 font-medium">Can teach</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((m) => (
              <tr key={m.name} className="border-t border-ink-800/80">
                <td className="py-1.5">{m.name}</td>
                <td className="py-1.5 text-ink-400 num">{m.lastSeen ? `#${m.lastSeen.number}` : '—'}</td>
                <td className="py-1.5 text-ink-400 num">{m.lastDemoed ? `#${m.lastDemoed.number}` : '—'}</td>
                <td className="py-1.5 text-ink-500">—</td>
                <td className="py-1.5 text-ink-500">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[11px] text-ink-500 border-t border-ink-700/60 pt-2">
        Profile fields populated next pass. See framework Layer C.
      </div>
    </div>
  );
}
