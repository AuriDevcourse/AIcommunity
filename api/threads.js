// Vercel serverless function → /api/threads
//   GET  ?date=YYYY-MM-DD → comments for that session + configured flag
//   POST → { action: 'post' | 'delete', date, ... }
import { handleThreads } from './_threads.js';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(url.searchParams);
    const { status, json } = await handleThreads({ method: req.method, body, query });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
