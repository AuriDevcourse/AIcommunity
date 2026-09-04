// Vercel serverless function → /api/polls
// On Vercel this needs an Upstash Redis KV store (env KV_REST_API_URL / KV_REST_API_TOKEN).
// Locally it falls back to data/polls-store.json via the dev middleware in vite.config.js.
import { handlePolls } from './_polls-core.js';
import { guardMutation, requireUser, requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    let user = null;
    if (req.method === 'GET') {
      // Forum reads are members-only. Auth-dependent, so never edge-cached.
      res.setHeader('Cache-Control', PRIVATE_CACHE);
      const who = await requireReader(req);
      if (who.blocked) return res.status(who.blocked.status).json(who.blocked.json);
      user = who.user;
    } else {
      const blocked = await guardMutation(req, { bucket: 'polls', limit: 60 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
      // Identity comes from the verified session, never the body. When Supabase
      // is not configured at all the app runs in typed-name mode, so `user`
      // stays null and the handler falls back to the body's name.
      const u = await requireUser(req);
      if (u.blocked) return res.status(u.blocked.status).json(u.blocked.json);
      user = u.user || null;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handlePolls({ method: req.method, body, user });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/polls error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
