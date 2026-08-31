// Vercel serverless function → POST /api/generate-post  { notes, format }
// Returns { ok, text } or { configured:false } when OPENROUTER_API_KEY is unset.
import { handleGeneratePost, streamPostToRes, postmakerConfigured } from './_postmaker.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  try {
    // Paid LLM route, gate tightly (auth + low rate cap).
    const blocked = await guardMutation(req, { bucket: 'generate-post', limit: 10 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    // Streaming branch: validate up front (can't send a JSON error mid-SSE).
    if (body.stream) {
      if (!postmakerConfigured()) return res.status(200).json({ ok: false, configured: false });
      if (!String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'notes required' });
      return streamPostToRes(res, body);
    }
    const { status, json } = await handleGeneratePost({ body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/generate-post error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
