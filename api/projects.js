// Vercel serverless function → /api/projects
//   GET  → member project cards (signed-in members only)
//   POST → { action: 'save', building, shipped, link } upserts the caller's card
//          { action: 'delete', id } removes own card (organizer: any)
import { handleProjects } from './_projects.js';
import { guardMutation, requireUser, requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', PRIVATE_CACHE);
    if (req.method === 'GET') {
      const who = await requireReader(req);
      if (who.blocked) return res.status(who.blocked.status).json(who.blocked.json);
      const { status, json } = await handleProjects({ method: 'GET', user: who.user || null });
      return res.status(status).json(json);
    }
    const blocked = await guardMutation(req, { bucket: 'projects', limit: 20, dailyLimit: 100 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const u = await requireUser(req);
    if (u.blocked) return res.status(u.blocked.status).json(u.blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleProjects({ method: req.method, body, user: u.user || null });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/projects error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
