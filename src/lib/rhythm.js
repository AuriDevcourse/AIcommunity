// The rhythm is the product: AI Sundays happens every second Sunday, 12:30 to
// 15:00, at Matrikel1. Google Calendar is the source of truth for the next date,
// data/schedule.json the reviewed snapshot, and this is the floor under both.
//
// Why a floor: Home used to trust the calendar completely. With GCAL_CALENDAR_ID
// unset in Vercel, or the API down, it fell back to schedule.json, whose entries
// ended in July, and the hero announced "Nothing scheduled". A meetup site that
// cannot state its next date has nothing. The rule below always can.
//
// The rule lives in data/schedule.json under `rhythm` so a venue or time change is
// a data edit, not a code change:
//   { anchor: '2026-08-30', everyDays: 14, start: '12:30', end: '15:00',
//     venue: 'Matrikel1, Højbro Pl. 10, 1200 København, Denmark',
//     timeZone: 'Europe/Copenhagen' }

const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().slice(0, 10);

// UTC instant for `date` at `hh:mm` wall-clock time in `timeZone`, as an ISO
// string. Tries the two candidate offsets (DST or not) and keeps the one that
// formats back to the requested hour, so it is right on both sides of a clock
// change without a tz database.
export function zonedIso(date, hhmm, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const offsetH of [1, 2, 0, 3]) {
    const guess = new Date(Date.UTC(y, m - 1, d, hh - offsetH, mm));
    const parts = fmt.formatToParts(guess);
    const gotH = Number(parts.find((p) => p.type === 'hour')?.value);
    const gotM = Number(parts.find((p) => p.type === 'minute')?.value);
    if (gotH === hh && gotM === mm) return guess.toISOString();
  }
  return new Date(Date.UTC(y, m - 1, d, hh - 1, mm)).toISOString();
}

// The next `count` dates on the rhythm from `today` (inclusive of today).
export function rhythmDates(rhythm, today, count = 3) {
  if (!rhythm?.anchor) return [];
  const every = Math.max(1, Number(rhythm.everyDays) || 14);
  const anchor = new Date(`${rhythm.anchor}T00:00:00Z`);
  const from = new Date(`${isoDate(today)}T00:00:00Z`);
  const elapsed = Math.floor((from - anchor) / DAY);
  // First occurrence on or after `from`, whether we are before or after the anchor.
  const steps = elapsed <= 0 ? Math.ceil(elapsed / every) : Math.ceil(elapsed / every);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(isoDate(new Date(anchor.getTime() + (steps + i) * every * DAY)));
  }
  return out;
}

// Sessions in the same shape the calendar and schedule.json produce, flagged
// `source: 'rhythm'` so the card can say the date follows the usual rhythm and is
// not yet confirmed.
export function rhythmSessions(rhythm, today, count = 3) {
  if (!rhythm?.anchor) return [];
  const tz = rhythm.timeZone || 'Europe/Copenhagen';
  return rhythmDates(rhythm, today, count).map((date) => ({
    date,
    theme: '',
    venue: rhythm.venue || '',
    venueStatus: 'usual',
    format: 'tbd',
    presenter: '',
    number: null,
    notes: '',
    startsAt: rhythm.start ? zonedIso(date, rhythm.start, tz) : '',
    endsAt: rhythm.end ? zonedIso(date, rhythm.end, tz) : '',
    source: 'rhythm',
  }));
}

// True when a list of sessions has nothing from `today` on.
export function nothingUpcoming(sessions, today) {
  const t = isoDate(today);
  return !(sessions || []).some((s) => s?.date >= t);
}
