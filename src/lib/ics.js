import { SESSION_START_HOUR, SESSION_START_MINUTE, SESSION_TZ, sessionStart } from './dates.js';

/**
 * A calendar file for one session.
 *
 * The hero already offers a Google Calendar template link. This is the same
 * event for everyone not on Google: Apple Calendar, Outlook, Thunderbird and
 * anything else that reads .ics. Built in the browser as a data: URL, so it
 * needs no endpoint and no round trip.
 *
 * Times are written in UTC with a Z suffix rather than a local time plus a
 * VTIMEZONE block. Writing a floating local time would shift the session by an
 * hour for anyone not in Copenhagen, and a correct VTIMEZONE is a lot of lines
 * to hand-roll for one recurring event.
 */

const pad = (n) => String(n).padStart(2, '0');

/** A Date to the iCalendar UTC stamp, 20260913T103000Z. */
function stamp(date) {
  return [
    date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate()),
    'T', pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds()), 'Z',
  ].join('');
}

/**
 * Escape a value for iCalendar. Commas, semicolons and backslashes are
 * delimiters in the format, and a raw newline ends the property, so an
 * unescaped session note would truncate the file at that point.
 */
const esc = (v) => String(v || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

export function icsText(session) {
  if (!session?.date) return '';
  const start = sessionStart(session);
  const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000); // sessions run 12:30 to 15:00
  const title = session.theme ? `AI Sundays: ${session.theme}` : 'AI Sundays';
  const body = session.notes || 'AI Sundays bi-weekly meetup · Copenhagen';

  // RFC 5545 wants CRLF line endings, and readers are stricter about it than
  // you would hope.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Sundays//dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ai-sundays-${session.date}@aisundays.org`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(body)}`,
    `LOCATION:${esc(session.venue || 'Copenhagen')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * A data: URL for the file.
 *
 * data: rather than a blob: object URL because a blob URL has to be revoked or
 * it leaks for the life of the document, and this link can be re-rendered on
 * every countdown tick.
 */
export function icsHref(session) {
  const text = icsText(session);
  if (!text) return '#';
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`;
}

export function icsFilename(session) {
  return `ai-sundays-${session?.date || 'session'}.ics`;
}

// Kept so a caller can build a start time without importing dates.js directly.
export { SESSION_START_HOUR, SESSION_START_MINUTE, SESSION_TZ };
