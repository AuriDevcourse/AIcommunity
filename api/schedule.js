// Vercel serverless function → /api/schedule
//   GET → { configured, upcoming: [{ date, theme, venue, ... }] }
// Live upcoming sessions read straight from Google Calendar (the organiser's
// primary calendar), so adding/moving an event there updates the dashboard
// without a redeploy. Public + edge-cached; reading a guest count is harmless.
// Returns { configured:false } when GCAL_* env isn't set, the client then falls
// back to the static build-time schedule snapshot.
import { listUpcomingSessions } from './_gcal.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' });
    const data = await listUpcomingSessions({});
    if (data.configured === false) return res.status(200).json({ configured: false });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    console.error('/api/schedule error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
