import { SESSION_START_HOUR, SESSION_START_MINUTE, SESSION_TZ } from './dates.js';

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
  const end = `${dateStr}T${pad(SESSION_START_HOUR + 2)}${pad(SESSION_START_MINUTE)}00`;
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
