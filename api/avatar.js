// Vercel serverless function → /api/avatar
//   POST { contentType, data(base64) } → { ok, url }
// Signed-in only. The target path comes from the verified user id, so the body
// can only ever change the caller's own avatar.
import { handleAvatar } from './_avatar.js';
import { guardMutation, requireUser } from './_guard.js';

export default async function handler(req, res) {
  try {
    const blocked = await guardMutation(req, { bucket: 'avatar', limit: 10, dailyLimit: 30 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const who = await requireUser(req);
    if (who.blocked) return res.status(who.blocked.status).json(who.blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleAvatar({ method: req.method, body, user: who.user || null });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/avatar error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
