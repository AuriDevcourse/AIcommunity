// Vercel serverless function → /api/rsvp
//   GET  ?date=YYYY-MM-DD  → { going, maybe, counts }. Names only for signed-in
//                            members; a signed-out visitor gets counts.
//   POST { date, status }  → upsert the caller's RSVP (auth required; identity
//                            comes from the verified Supabase session, not body)
import { handleRsvpGet, handleRsvpPost } from './_rsvp.js';
import { guardMutation, requireUser, requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', PRIVATE_CACHE);
      const who = await requireReader(req);
      const user = who.blocked ? null : (who.user || (who.open ? { open: true } : null));
      const { status, json } = await handleRsvpGet({ query: req.query || {}, user });
      return res.status(status).json(json);
    }
    if (req.method === 'POST') {
      const blocked = await guardMutation(req, { bucket: 'rsvp', limit: 30 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
      const u = await requireUser(req);
      if (u.configured === false) return res.status(200).json({ ok: false, configured: false });
      if (u.blocked) return res.status(u.blocked.status).json(u.blocked.json);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { status, json } = await handleRsvpPost({ body, user: u.user });
      return res.status(status).json(json);
    }
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('/api/rsvp error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
