// Anchored at LOCAL noon, not UTC noon. Using UTC date parts meant that between
// midnight and 02:00 Copenhagen time (UTC+2) the dashboard still reported
// yesterday's date. Noon keeps the value clear of DST edges either way.
function todayAtNoon() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

export const TODAY = todayAtNoon();

// Format from LOCAL parts. `toISOString()` converts to UTC first, which shifts
// the date for anyone far enough east of Greenwich even with a noon anchor.
export function toIso(d = TODAY) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(s) {
  return new Date(`${s}T12:00:00`);
}

export function daysBetween(a, b) {
  const ms = parseDate(b) - (a instanceof Date ? a : parseDate(a));
  return Math.round(ms / 86400000);
}

export function fmtDate(s) {
  const d = parseDate(s);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateLong(s) {
  const d = parseDate(s);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function relative(s, today = TODAY) {
  const d = daysBetween(today, s);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 0 && d < 7) return `in ${d} days`;
  if (d > 0 && d < 30) return `in ${Math.round(d / 7)} wk`;
  if (d > 0) return `in ${Math.round(d / 30)} mo`;
  if (d < 0 && d > -30) return `${-d} days ago`;
  return `${Math.round(-d / 30)} mo ago`;
}

export function fridayBefore(sundayIso) {
  const d = parseDate(sundayIso);
  d.setDate(d.getDate() - 2);
  return d;
}
