// Vercel serverless function → /api/topics
//   GET  → list discussion topics (newest first) + configured flag
//   POST → { action: 'create' | 'delete', ... }
import { handleTopics } from './_topics.js';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleTopics({ method: req.method, body });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
