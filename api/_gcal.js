// Reads the session event's guest list from Google Calendar and returns who
// accepted. Attendee RSVP status is private, so this authenticates as the event
// organiser via a stored OAuth refresh token (no public API key can see it).
//
// Env (set in .env.local for dev, Vercel project env for prod):
//   GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REFRESH_TOKEN  — OAuth credentials
//   GCAL_CALENDAR_ID  (optional, default 'primary')
//   GCAL_EVENT_MATCH  (optional, default 'AI Workshop') — title substring to pick the event
//
// Mint the refresh token once with: npm run google:auth

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

export function gcalConfigured() {
  return Boolean(process.env.GCAL_CLIENT_ID && process.env.GCAL_CLIENT_SECRET && process.env.GCAL_REFRESH_TOKEN);
}

async function getAccessToken() {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GCAL_CLIENT_ID,
      client_secret: process.env.GCAL_CLIENT_SECRET,
      refresh_token: process.env.GCAL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token refresh failed: ${j.error || r.status} ${j.error_description || ''}`.trim());
  return j.access_token;
}

// Picks the event on `date` (YYYY-MM-DD) whose title contains the match string.
async function findEvent(accessToken, date, calendarId, match) {
  const params = new URLSearchParams({
    timeMin: `${date}T00:00:00Z`,
    timeMax: `${date}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const r = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`events.list failed: ${j.error?.message || r.status}`);
  const items = j.items || [];
  const m = String(match || '').toLowerCase();
  const hit =
    items.find((e) => (e.summary || '').toLowerCase().includes(m) && (e.attendees || []).length) ||
    items.find((e) => (e.attendees || []).length) ||
    null;
  return hit;
}

const STATUS = { accepted: 'accepted', tentative: 'tentative', declined: 'declined', needsAction: 'needsAction' };

export async function getSessionAttendees({ date, calendarId, match }) {
  if (!gcalConfigured()) return { configured: false };
  if (!date) throw new Error('date required');
  const cal = calendarId || process.env.GCAL_CALENDAR_ID || 'primary';
  const matchStr = match ?? process.env.GCAL_EVENT_MATCH ?? 'AI Workshop';

  const token = await getAccessToken();
  const event = await findEvent(token, date, cal, matchStr);
  if (!event) return { configured: true, found: false, date };

  const guests = (event.attendees || [])
    .filter((a) => !a.resource) // drop meeting rooms / resources
    .map((a) => ({
      name: a.displayName || (a.email ? a.email.split('@')[0] : 'Guest'),
      email: a.email || '',
      status: STATUS[a.responseStatus] || 'needsAction',
      organizer: Boolean(a.organizer),
    }));

  const counts = { accepted: 0, tentative: 0, declined: 0, needsAction: 0 };
  for (const g of guests) counts[g.status] += 1;

  return {
    configured: true,
    found: true,
    date,
    event: { summary: event.summary || '', start: event.start?.dateTime || event.start?.date || '' },
    guests,
    accepted: guests.filter((g) => g.status === 'accepted'),
    tentative: guests.filter((g) => g.status === 'tentative'),
    counts,
  };
}

export async function handleAttendees({ query }) {
  try {
    if (!gcalConfigured()) return { status: 200, json: { configured: false } };
    const data = await getSessionAttendees({ date: query?.date, match: query?.title });
    return { status: 200, json: { ...data, ok: true } };
  } catch (e) {
    return { status: 500, json: { ok: false, configured: true, error: e.message } };
  }
}
