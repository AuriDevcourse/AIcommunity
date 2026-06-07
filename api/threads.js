// Vercel serverless function → /api/threads
//   GET  ?date=YYYY-MM-DD → comments for that session + configured flag
//   POST → { action: 'post' | 'delete', date, ... }
import { handleThreads } from './_threads.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      const blocked = await guardMutation(req, { bucket: 'threads', limit: 60 });
      if (blocked) return res.status(blocked.status).json(blocked.json);
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(url.searchParams);
    const { status, json } = await handleThreads({ method: req.method, body, query });
    if (req.method === 'GET' && status === 200) res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/threads error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
