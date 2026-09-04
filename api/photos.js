// Vercel serverless function → /api/photos
//   GET    → list uploaded session photos grouped by date
//   POST   → Vercel Blob client-upload token handshake
//   DELETE → remove an uploaded photo (?url=...)
//   PATCH  → move an uploaded photo to another session ({ url, toDate })
import { listPhotos, uploadPhoto, deletePhoto, movePhoto, blobConfigured } from './_photos.js';
import { guardMutation, requireReader, requireUser, PRIVATE_CACHE } from './_guard.js';
import { isOrganizer, ORGANIZER_ONLY } from './_roles.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // The photo archive is members-only, so the listing is no longer public
      // or edge-cached: a shared cache would hand one member's reply to the next
      // stranger. Committed photos under public/sessions/ are static files and
      // stay reachable by URL; this gates the Blob uploads and the index.
      res.setHeader('Cache-Control', PRIVATE_CACHE);
      const who = await requireReader(req);
      if (who.blocked) return res.status(who.blocked.status).json(who.blocked.json);
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
      // Deleting is the organizer's alone (Auri, 2026-09-02). Members add and
      // move photos; nothing a member does removes one.
      const u = await requireUser(req);
      if (u.blocked) return res.status(u.blocked.status).json(u.blocked.json);
      if (!isOrganizer(u.user)) return res.status(ORGANIZER_ONLY.status).json(ORGANIZER_ONLY.json);
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
