// Vercel serverless function → /api/topics
//   GET  → list discussion topics (newest first) + configured flag
//   POST → { action: 'create' | 'delete', ... }
import { handleTopics } from './_topics.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      const blocked = await guardMutation(req, { bucket: 'topics', limit: 30 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleTopics({ method: req.method, body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/topics error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
