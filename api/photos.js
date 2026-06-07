// Vercel serverless function → /api/photos
//   GET    → list uploaded session photos grouped by date
//   POST   → Vercel Blob client-upload token handshake
//   DELETE → remove an uploaded photo (?url=...)
//   PATCH  → move an uploaded photo to another session ({ url, toDate })
import { listPhotos, uploadPhoto, deletePhoto, movePhoto, blobConfigured } from './_photos.js';
import { guardMutation } from './_guard.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Edge-cache the listing: served instantly on repeat loads, revalidated in
      // the background. Uploads are rare, so 60s of staleness is fine.
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(await listPhotos());
    }
    // Upload / move / delete are gated: signed-in + rate-limited.
    const blocked = await guardMutation(req, { bucket: 'photos', limit: 40 });
    if (blocked) return res.status(blocked.status).json(blocked.json);
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
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const r = await movePhoto(body.url, body.toDate);
      return res.status(200).json({ ok: true, ...r });
    }
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('/api/photos error:', e);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
}
