// Vercel serverless function → POST /api/generate-post  { notes, format }
// Returns { ok, text } or { configured:false } when OPENROUTER_API_KEY is unset.
import { handleGeneratePost, streamPostToRes, postmakerConfigured, MAX_NOTES_CHARS } from './_postmaker.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  try {
    // Paid LLM route, gated three ways: auth, a low per-minute rate, and a DAILY
    // cap. The rate limit alone bounds speed, not spend: 10/minute is 14,400 calls
    // a day without ever tripping it.
    const blocked = await guardMutation(req, { bucket: 'generate-post', limit: 10, dailyLimit: 40 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    // Streaming branch: validate up front (can't send a JSON error mid-SSE).
    if (body.stream) {
      if (!postmakerConfigured()) return res.status(200).json({ ok: false, configured: false });
      if (!String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'notes required' });
      // The non-stream path caps this in handleGeneratePost; the stream path has to
      // do it here, before any bytes go out, because an SSE response cannot carry a
      // JSON error afterwards.
      if (String(body.notes).length > MAX_NOTES_CHARS) {
        return res.status(413).json({ ok: false, error: 'That is too much text to summarise. Trim it and try again.' });
      }
      return streamPostToRes(res, body);
    }
    const { status, json } = await handleGeneratePost({ body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/generate-post error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
