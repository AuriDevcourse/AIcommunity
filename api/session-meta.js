// Vercel serverless function → /api/session-meta
//   GET  → { names: { <date>: "Custom name" }, configured }
//   POST → set/clear a session's display name ({ date, name }); empty name clears it
import { handleSessionMeta } from './_session-meta.js';

export default async function handler(req, res) {
  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const { status, json } = await handleSessionMeta({ method: req.method, body });
    return res.status(status).json(json);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
