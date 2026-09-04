// Vercel serverless function → /api/showcase
//   GET  → public list of showcase project cards (the Projects tab)
//   POST → { action: 'add' | 'delete', ... } for signed-in members
import { handleShowcase } from './_showcase.js';
import { guardMutation, requireUser, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // The Projects tab is public, so anyone can read. Soft-detect the caller
      // (never block an anonymous read) only to mark their own cards.
      const who = await requireUser(req);
      const viewer = who.blocked ? null : (who.user || null);
      const { status, json } = await handleShowcase({ method: 'GET', user: viewer });
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
      return res.status(status).json(json);
    }
    // Costs a Redis write and lets members post content, so rate + daily caps.
    const blocked = await guardMutation(req, { bucket: 'showcase', limit: 15, dailyLimit: 60 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const u = await requireUser(req);
    if (u.blocked) return res.status(u.blocked.status).json(u.blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    res.setHeader('Cache-Control', PRIVATE_CACHE);
    const { status, json } = await handleShowcase({ method: req.method, body, user: u.user || null });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/showcase error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
