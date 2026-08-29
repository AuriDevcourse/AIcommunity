// Shared session helpers. The time slot and timezone live in
// data/schedule.json → `cadence`; nothing here should hardcode them, or the
// three places that render a session time will drift apart again.

import { parseDate } from './dates.js';

const CADENCE_FALLBACK = { startTime: '12:30', endTime: '14:30', timezone: 'Europe/Copenhagen' };

export function resolveCadence(cadence) {
  return { ...CADENCE_FALLBACK, ...(cadence || {}) };
}

// "12:30" → "123000", the basic-format local time Google Calendar expects
// alongside an explicit ctz.
function toCalendarTime(hhmm) {
  return `${String(hhmm).replace(':', '')}00`;
}

// Local Date for the session start, used for countdowns. Built from the
// viewer's clock rather than the event timezone — close enough for a countdown,
// and it avoids shipping a timezone library for one number.
export function sessionStart(session, cadence) {
  if (!session?.date) return null;
  const { startTime } = resolveCadence(cadence);
  const [h, m] = String(startTime).split(':').map(Number);
  const d = parseDate(session.date);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 30, 0, 0);
  return d;
}

export function sessionTitle(session) {
  return session?.theme ? `AI Workshop — ${session.theme}` : 'AI Workshop Session';
}

export function googleCalendarUrl(session, cadence) {
  if (!session?.date) return '#';
  const { startTime, endTime, timezone } = resolveCadence(cadence);
  const dateStr = session.date.replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: sessionTitle(session),
    dates: `${dateStr}T${toCalendarTime(startTime)}/${dateStr}T${toCalendarTime(endTime)}`,
    ctz: timezone,
    location: session.venue || '',
    details: session.notes || 'AI Workshop bi-weekly meetup · Copenhagen',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Area 3.8 — Google Calendar is not everyone's calendar. An .ics blob covers
// Apple Calendar, Outlook and anything else, with no third-party round-trip.
function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildIcs(session, cadence) {
  const { startTime, endTime, timezone } = resolveCadence(cadence);
  const dateStr = session.date.replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Workshop//Cockpit//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ai-workshop-${session.date}@aiworkshop.local`,
    // Floating local time plus an explicit TZID keeps the event at 12:30 in
    // Copenhagen regardless of where the importing calendar thinks it is.
    `DTSTART;TZID=${timezone}:${dateStr}T${toCalendarTime(startTime)}`,
    `DTEND;TZID=${timezone}:${dateStr}T${toCalendarTime(endTime)}`,
    `SUMMARY:${icsEscape(sessionTitle(session))}`,
    `DESCRIPTION:${icsEscape(session.notes || 'AI Workshop bi-weekly meetup · Copenhagen')}`,
    session.venue ? `LOCATION:${icsEscape(session.venue)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadIcs(session, cadence) {
  const blob = new Blob([buildIcs(session, cadence)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-workshop-${session.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick; revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Area 3.3 — the operations framework defines a lifecycle from T-7 to T+3.
// Surfacing which phase we're in tells the organiser what is due right now.
export function lifecycle(session, today) {
  if (!session?.date) return null;
  const d = parseDate(session.date);
  const days = Math.round((d - today) / 86400000);
  if (days > 14) return { key: 'planning', label: 'Planning', tone: 'mute' };
  if (days > 7) return { key: 't-14', label: 'T-14 · lock the theme', tone: 'mute' };
  if (days > 2) return { key: 't-7', label: 'T-7 · confirm venue & demos', tone: 'warn' };
  if (days >= 0) return { key: 't-2', label: 'T-2 · send the reminder', tone: 'warn' };
  if (days >= -3) return { key: 't+3', label: 'T+3 · write the recap', tone: 'ok' };
  return null;
}

// Area 3.9 — the framework's rule: fewer than two demos and the session falls
// back to Lean Coffee. The data to decide that already exists in backlog.json.
export function leanCoffeeFallback(session, backlog) {
  if (!session) return false;
  if (session.format && session.format !== 'tbd') return false;
  const queued = Array.isArray(backlog) ? backlog.length : 0;
  return queued < 2;
}
