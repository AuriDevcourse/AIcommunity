// Vercel serverless function → /api/session-meta
//   GET  → { names: { <date>: "Custom name" }, configured }
//   POST → set/clear a session's display name ({ date, name }); empty name clears it
import { handleSessionMeta } from './_session-meta.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      const blocked = await guardMutation(req, { bucket: 'session-meta', limit: 60 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
    }
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const { status, json } = await handleSessionMeta({ method: req.method, body });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/session-meta error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
