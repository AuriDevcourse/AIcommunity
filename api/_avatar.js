// Profile avatar uploads, backed by Vercel Blob.
//
// The profile editor already let a member pick a generated avatar or paste a
// URL. Uploading a real photo needs somewhere to put the bytes, and the same
// Blob store that holds session photos is the obvious home. Avatars live under
// avatars/<userId>/ so one member can never touch another member's image: the
// path is derived from the VERIFIED session, never from the body.
//
// Flow: browser downscales to a small square JPEG (compressImage, 256px), POSTs
// base64, we put() it and return the public URL. The client then stores that URL
// in Supabase user_metadata.avatar_url, which is what nameOf/avatarOf read.
import { list, del, put } from '@vercel/blob';
import { blobConfigured } from './_photos.js';

const PREFIX = 'avatars/';
const MAX_BYTES = 600 * 1024; // a 256px JPEG is ~20-40KB; anything near this is wrong
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function uploadAvatar({ userId, contentType, data }) {
  if (!blobConfigured()) throw new Error('uploads not configured');
  const uid = String(userId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  if (!uid) throw new Error('user required');
  if (!data) throw new Error('no image data');
  const ext = TYPES[contentType];
  if (!ext) throw new Error('use a JPG, PNG or WebP image');
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_BYTES) throw new Error('image too large');

  const dir = `${PREFIX}${uid}/`;
  const { url } = await put(`${dir}avatar.${ext}`, buffer, {
    access: 'public',
    contentType,
    // Random suffix = new URL on every upload, so a cached old avatar never
    // sticks in the header or in other members' forum views.
    addRandomSuffix: true,
  });

  // Remove the previous avatar(s) so the store holds one image per member.
  // Best effort: a failed cleanup must not fail the upload.
  try {
    const { blobs } = await list({ prefix: dir });
    const stale = blobs.filter((b) => b.url !== url).map((b) => b.url);
    if (stale.length) await del(stale);
  } catch (e) {
    console.warn('[avatar] cleanup skipped:', e?.message || e);
  }
  return { url };
}

// Shared handler so api/avatar.js (Vercel) and the Vite dev middleware behave
// identically. `user` is the verified Supabase user from requireUser.
export async function handleAvatar({ method, body, user }) {
  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!user?.id) return { status: 401, json: { ok: false, error: 'Please sign in to do that.' } };
  if (!blobConfigured()) return { status: 503, json: { ok: false, configured: false, error: 'Photo uploads are not configured on this deployment.' } };
  try {
    const r = await uploadAvatar({ userId: user.id, contentType: body?.contentType, data: body?.data });
    return { status: 200, json: { ok: true, ...r } };
  } catch (e) {
    // Validation messages are written for the member; anything else stays in the log.
    const known = ['no image data', 'image too large', 'use a JPG, PNG or WebP image'];
    if (known.includes(e?.message)) return { status: 422, json: { ok: false, error: e.message } };
    console.error('[avatar] upload failed:', e);
    return { status: 500, json: { ok: false, error: 'Could not save the photo. Try again.' } };
  }
}
