import { SESSION_START_HOUR, SESSION_START_MINUTE, SESSION_DURATION_HOURS, SESSION_TZ } from './dates.js';

/**
 * Google Calendar "add event" template URL for a session.
 *
 * Lifted out of NextSession so the hero can offer it as the primary action
 * without a second copy of the same builder.
 */
export function googleCalendarUrl(session) {
  if (!session?.date) return null;
  const dateStr = session.date.replace(/-/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${dateStr}T${pad(SESSION_START_HOUR)}${pad(SESSION_START_MINUTE)}00`;
  // End from the shared duration, in minutes, so a half-hour length works.
  const endM = SESSION_START_HOUR * 60 + SESSION_START_MINUTE + Math.round(SESSION_DURATION_HOURS * 60);
  const end = `${dateStr}T${pad(Math.floor(endM / 60) % 24)}${pad(endM % 60)}00`;
  const title = session.theme ? `AI Sundays: ${session.theme}` : 'AI Sundays Session';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    ctz: SESSION_TZ,
    location: session.venue || '',
    details: session.notes || 'AI Sundays bi-weekly meetup · Copenhagen',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
