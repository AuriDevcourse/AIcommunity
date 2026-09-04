// Vercel serverless function → /api/attendees?date=YYYY-MM-DD
// Who accepted the session's Google Calendar invite. Needs GCAL_* env vars (see
// api/_gcal.js); without them it returns { configured: false }.
//
// Names are for signed-in members. A signed-out visitor gets the counts only, so
// the Home page can still say "6 coming" without publishing who.
import { handleAttendees } from './_gcal.js';
import { requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', PRIVATE_CACHE);
  const who = await requireReader(req);
  const user = who.blocked ? null : (who.user || (who.open ? { open: true } : null));
  const { status, json } = await handleAttendees({ query: req.query || {}, user });
  res.status(status).json(json);
}
