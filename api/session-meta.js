// Vercel serverless function → /api/session-meta
//   GET  → { names: { <date>: "Custom name" }, configured }
//   POST → set/clear a session's display name ({ date, name }); empty name clears it
import { handleSessionMeta } from './_session-meta.js';
import { guardMutation, requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    let user = null;
    if (req.method === 'GET') {
      // The reply differs by reader (photo URLs only for members), so it must
      // never sit in a shared edge cache.
      res.setHeader('Cache-Control', PRIVATE_CACHE);
      const who = await requireReader(req);
      user = who.blocked ? null : (who.user || (who.open ? { open: true } : null));
    } else {
      const blocked = await guardMutation(req, { bucket: 'session-meta', limit: 60 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
    }
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const { status, json } = await handleSessionMeta({ method: req.method, body, user });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/session-meta error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
