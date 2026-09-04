// Vercel serverless function → /api/members
//   GET → { members, profiles, attendeesByDate }   signed-in members only
import { handleMembers } from './_members.js';
import { requireReader, PRIVATE_CACHE } from './_guard.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', PRIVATE_CACHE);
    const who = await requireReader(req);
    if (who.blocked) return res.status(who.blocked.status).json(who.blocked.json);
    const { status, json } = await handleMembers({ method: req.method, user: who.user || null });
    return res.status(status).json(json);
  } catch (e) {
    console.error('/api/members error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
