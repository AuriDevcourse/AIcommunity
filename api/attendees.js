// Vercel serverless function → /api/attendees?date=YYYY-MM-DD
// Returns who accepted the session's Google Calendar invite. Needs GCAL_* env
// vars (see api/_gcal.js); without them it returns { configured: false }.
import { handleAttendees } from './_gcal.js';

export default async function handler(req, res) {
  const { status, json } = await handleAttendees({ query: req.query || {} });
  // Calendar RSVPs change slowly, cache hard at the edge with background refresh.
  if (status === 200) res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(status).json(json);
}
