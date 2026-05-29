// Vercel serverless function → POST /api/generate-post  { notes, format }
// Returns { ok, text } or { configured:false } when OPENROUTER_API_KEY is unset.
import { handleGeneratePost } from './_postmaker.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleGeneratePost({ body });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
