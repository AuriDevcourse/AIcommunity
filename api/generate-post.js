// Vercel serverless function → POST /api/generate-post  { notes, format }
// Returns { ok, text } or { configured:false } when OPENROUTER_API_KEY is unset.
import { handleGeneratePost } from './_postmaker.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  try {
    // Paid LLM route — gate tightly (auth + low rate cap).
    const blocked = await guardMutation(req, { bucket: 'generate-post', limit: 10 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleGeneratePost({ body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/generate-post error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
