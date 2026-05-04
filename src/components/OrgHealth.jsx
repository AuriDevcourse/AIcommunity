// Org health metrics computed from session data.
// Some metrics aren't tracked yet — those are marked "track manually".
export default function OrgHealth({ sessions, members }) {
  const last6 = sessions.slice(-6);

  // Active members: appeared in ≥3 of last 6 sessions.
  const attendanceCount = new Map();
  for (const s of last6) {
    for (const a of s.attendees) {
      const key = a.toLowerCase().split(/\s+/)[0];
      attendanceCount.set(key, (attendanceCount.get(key) || 0) + 1);
    }
  }
  const activeCount = [...attendanceCount.values()].filter((n) => n >= 3).length;

  // Demo rotation: distinct presenters across last 6.
  const presenters = new Set();
  for (const s of last6) for (const d of s.demos) presenters.add(d.presenter.toLowerCase());

  // Avg attendance last 6.
  const avgAttendance = last6.length
    ? Math.round((last6.reduce((sum, s) => sum + s.attendees.length, 0) / last6.length) * 10) / 10
    : 0;

  const metrics = [
    {
      label: 'Active members',
      value: `${activeCount} / 10`,
      status: activeCount >= 10 ? 'ok' : activeCount >= 6 ? 'warn' : 'err',
      hint: '≥3 of last 6 sessions',
    },
    {
      label: 'Demo rotation',
      value: `${presenters.size} / 5`,
      status: presenters.size >= 5 ? 'ok' : presenters.size >= 3 ? 'warn' : 'err',
      hint: 'distinct presenters, last 6',
    },
    {
      label: 'Avg attendance',
      value: `${avgAttendance}`,
      status: avgAttendance >= 5 ? 'ok' : avgAttendance >= 3 ? 'warn' : 'err',
      hint: 'last 6 sessions',
    },
    { label: 'Content cadence',     value: '—', status: 'mute', hint: 'recap T+1, LinkedIn T+2 · track manually' },
    { label: 'Leadership rotation', value: '—', status: 'mute', hint: 'non-Auri host · track manually' },
    { label: 'Format variety',      value: '—', status: 'mute', hint: 'mix across last 6 · track manually' },
  ];

  return (
    <div className="card card-pad h-full">
      <div className="flex items-baseline justify-between">
        <div className="h-section">Org health</div>
        <div className="text-xs text-ink-500">framework targets</div>
      </div>
      <ul className="mt-3 space-y-2">
        {metrics.map((m) => (
          <li key={m.label} className="flex items-center gap-3 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              m.status === 'ok' ? 'bg-ok' :
              m.status === 'warn' ? 'bg-warn' :
              m.status === 'err' ? 'bg-err' :
              'bg-ink-700'
            }`} />
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-ink-100">{m.label}</span>
                <span className="num text-ink-300">{m.value}</span>
              </div>
              <div className="text-[11px] text-ink-500">{m.hint}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-[11px] text-ink-500 border-t border-ink-700/60 pt-3">
        Computed from session notes. See <span className="font-mono text-ink-300">Community Operations Framework.md</span>.
      </div>
    </div>
  );
}
