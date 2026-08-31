// Reads the session event's guest list from Google Calendar and returns who
// accepted. Attendee RSVP status is private, so this authenticates as the event
// organiser via a stored OAuth refresh token (no public API key can see it).
//
// Env (set in .env.local for dev, Vercel project env for prod):
//   GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REFRESH_TOKEN. OAuth credentials
//   GCAL_CALENDAR_ID  (optional, default 'primary')
//   GCAL_EVENT_MATCH  (optional), title substring to pick the event. Comma-
//                     separated alternatives are allowed; any one matching wins.
//                     Defaults to the community's current AND former name, so a
//                     calendar renamed on one side does not empty the schedule.
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
  const matches = typeof match === 'function' ? match : titleMatcher(match);
  // Title match only. There used to be a second fallback that accepted ANY event
  // with attendees, so on a date where the session had none it happily returned
  // a personal event from the same calendar and published its guest list. No
  // match must mean no data: an empty Coming list is correct, a stranger's
  // guest list is not.
  return items.find((e) => matches(e.summary) && (e.attendees || []).length) || null;
}

const STATUS = { accepted: 'accepted', tentative: 'tentative', declined: 'declined', needsAction: 'needsAction' };

// The community was renamed from "AI Workshop" to "AI Sundays". Calendar events
// live in Google, not in this repo, so both names are matched: whichever way the
// events are titled (and however long the rename takes), the schedule still fills.
const DEFAULT_EVENT_MATCH = 'AI Sundays,AI Workshop';

// A matcher for one or more comma-separated title substrings.
const titleMatcher = (match) => {
  const needles = String(match ?? process.env.GCAL_EVENT_MATCH ?? DEFAULT_EVENT_MATCH)
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return (summary) => {
    const t = String(summary || '').toLowerCase();
    return needles.some((n) => t.includes(n));
  };
};

export async function getSessionAttendees({ date, calendarId, match }) {
  if (!gcalConfigured()) return { configured: false };
  if (!date) throw new Error('date required');
  const cal = calendarId || process.env.GCAL_CALENDAR_ID || 'primary';
  const matches = titleMatcher(match);

  const token = await getAccessToken();
  const event = await findEvent(token, date, cal, matches);
  if (!event) return { configured: true, found: false, date };

  const guests = (event.attendees || [])
    .filter((a) => !a.resource) // drop meeting rooms / resources
    .map((a) => ({
      // The address is deliberately NOT returned. This endpoint is public and
      // unauthenticated, so anything here is published. The UI only ever renders
      // a first name and a photo, and the local part is enough to match a guest
      // to a member by name token.
      name: a.displayName || (a.email ? a.email.split('@')[0] : 'Guest'),
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

// Map a raw Google Calendar event to the app's session shape. By design the
// calendar only drives date + title + venue; the richer fields (format, presenter,
// host, Luma) stay blank, they're not encoded in a plain event.
function toSession(e) {
  const startRaw = e.start?.dateTime || e.start?.date || '';
  const date = startRaw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Strip a leading "AI Sundays" / "AI Workshop" prefix (with or without a
  // separator) so what is left is the theme.
  const theme = String(e.summary || '')
    .replace(/^\s*ai\s*(sundays|workshop)\s*[:\-–—]?\s*/i, '')
    .trim();
  return {
    date,
    theme,
    venue: String(e.location || '').trim(),
    notes: '', // the calendar event description is the generic community blurb, skip it
    // Real start instant when the event is timed (all-day events have no
    // dateTime). Lets the hero count down to the actual time rather than
    // assuming the usual 12:30.
    startsAt: e.start?.dateTime || '',
    format: 'tbd',
    presenter: '',
    number: null,
    source: 'gcal',
  };
}

// List upcoming AI Sundays events (from now forward), newest-day first deduped,
// for the live schedule. Same auth as the attendee lookup.
export async function listUpcomingSessions({ calendarId, match, max = 8, now } = {}) {
  if (!gcalConfigured()) return { configured: false };
  const cal = calendarId || process.env.GCAL_CALENDAR_ID || 'primary';
  const matches = titleMatcher(match);

  const token = await getAccessToken();
  const params = new URLSearchParams({
    timeMin: (now ? new Date(now) : new Date()).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const r = await fetch(`${API}/calendars/${encodeURIComponent(cal)}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`events.list failed: ${j.error?.message || r.status}`);

  const seen = new Set();
  const upcoming = (j.items || [])
    .filter((e) => e.status !== 'cancelled' && matches(e.summary))
    .map(toSession)
    .filter(Boolean)
    .filter((s) => (seen.has(s.date) ? false : (seen.add(s.date), true))) // one per day
    .slice(0, max);
  return { configured: true, upcoming };
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
