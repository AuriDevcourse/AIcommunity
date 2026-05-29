// Vercel serverless function → /api/polls
// On Vercel this needs an Upstash Redis KV store (env KV_REST_API_URL / KV_REST_API_TOKEN).
// Locally it falls back to data/polls-store.json via the dev middleware in vite.config.js.
import { handlePolls } from './_polls-core.js';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handlePolls({ method: req.method, body });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
