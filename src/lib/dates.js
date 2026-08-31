function todayAtNoon() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
}

export const TODAY = todayAtNoon();

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
  // Days out to a fortnight, not weeks. At 12 days the old rounding said "in
  // 2 wk" while the hero counted down "12 days 21 hr" beside it, so the two
  // controls on the same screen disagreed about the same date.
  if (d > 0 && d < 14) return `in ${d} days`;
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

// The community meets 12:30–14:30 Europe/Copenhagen. That is hardcoded in the
// calendar-link builder too; the Google Calendar feed drops the time (api/_gcal.js
// keeps only the date), so this is the app's single source of truth for it until
// a session carries a real `startsAt`.
export const SESSION_START_HOUR = 12;
export const SESSION_START_MINUTE = 30;
export const SESSION_TZ = 'Europe/Copenhagen';

// Minutes that `tz` is ahead of UTC at the given instant. Derived from Intl
// rather than hardcoded, so CEST/CET switches take care of themselves.
function tzOffsetMinutes(date, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  // formatToParts yields hour "24" for midnight in some engines.
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return (asUtc - date.getTime()) / 60000;
}

/**
 * The exact instant a session starts. Prefers a real `startsAt` from the
 * calendar feed; otherwise pins the local start time to Copenhagen.
 * Returns null when the date is unusable, so callers can hide the countdown
 * rather than render NaN.
 */
export function sessionStart(session) {
  if (!session?.date) return null;
  if (session.startsAt) {
    const d = new Date(session.startsAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const hh = String(SESSION_START_HOUR).padStart(2, '0');
  const mm = String(SESSION_START_MINUTE).padStart(2, '0');
  const guess = new Date(`${session.date}T${hh}:${mm}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(guess.getTime() - tzOffsetMinutes(guess, SESSION_TZ) * 60000);
}

/**
 * Coarse-to-fine countdown: days and hours far out, minutes and seconds close in.
 * Returns null once the start has passed, which is the caller's cue to switch
 * to a "happening now" state instead.
 */
export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return [{ n: days, u: days === 1 ? 'day' : 'days' }, { n: hours, u: 'hr' }];
  if (hours > 0) return [{ n: hours, u: hours === 1 ? 'hr' : 'hrs' }, { n: minutes, u: 'min' }];
  if (minutes > 0) return [{ n: minutes, u: 'min' }, { n: seconds, u: 'sec' }];
  return [{ n: seconds, u: 'sec' }];
}

/** Short "Sat 30 Aug" for today, used to pair today with the next session. */
export function fmtToday(d = new Date()) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
