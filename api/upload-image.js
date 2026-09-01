// Vercel serverless function → /api/upload-image
//   POST { image: <base64>, name? } → { ok, url } (proxies to ImgBB)
import { handleImageUpload } from './_imgbb.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
    // Costs money per call at the host, so a daily ceiling as well as a rate.
    const blocked = await guardMutation(req, { bucket: 'upload-image', limit: 30, dailyLimit: 120 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleImageUpload({ body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/upload-image error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
