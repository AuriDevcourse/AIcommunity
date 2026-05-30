// Vercel serverless function → /api/upload-image
//   POST { image: <base64>, name? } → { ok, url } (proxies to ImgBB)
import { handleImageUpload } from './_imgbb.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleImageUpload({ body });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
