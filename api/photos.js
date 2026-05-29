// Vercel serverless function → /api/photos
//   GET    → list uploaded session photos grouped by date
//   POST   → Vercel Blob client-upload token handshake
//   DELETE → remove an uploaded photo (?url=...)
import { listPhotos, uploadPhoto, deletePhoto, blobConfigured } from './_photos.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listPhotos());
    }
    if (!blobConfigured()) {
      return res.status(200).json({ ok: false, configured: false, error: 'uploads not configured' });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const r = await uploadPhoto(body);
      return res.status(200).json({ ok: true, ...r });
    }
    if (req.method === 'DELETE') {
      await deletePhoto(req.query?.url || '');
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
