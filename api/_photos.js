// Session photo uploads, backed by Vercel Blob. Committed photos in
// public/sessions/<date>/ are baked in at build time; these are runtime uploads
// anyone can add from the gathering. They live under sessions/<date>/ in Blob and
// the Sessions gallery merges both sources by date.
//
// Uploads come in as base64 JSON (the browser downscales first, so payloads are
// small and well under the function body limit), and we write them with put().
// Needs BLOB_READ_WRITE_TOKEN (auto-injected on Vercel; .env.local for dev).
import { list, del, put, copy } from '@vercel/blob';

const PREFIX = 'sessions/';
const deslug = (s) => s.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const slug = (s) => String(s || 'guest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'guest';
const safeFile = (s) => String(s || 'photo.jpg').replace(/[^a-zA-Z0-9.]+/g, '-').slice(-40);

export function blobConfigured() {
  // Classic read-write token OR the newer OIDC connection (injects BLOB_STORE_ID).
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

// All uploaded photos grouped by session date.
export async function listPhotos() {
  if (!blobConfigured()) return { configured: false, byDate: {} };
  const { blobs } = await list({ prefix: PREFIX });
  const byDate = {};
  for (const b of blobs) {
    const parts = b.pathname.split('/'); // sessions/<date>/<file>
    if (parts.length < 3) continue;
    const date = parts[1];
    const file = parts.slice(2).join('/');
    const uploader = file.includes('__') ? deslug(file.split('__')[0]) : '';
    (byDate[date] ||= []).push({ url: b.url, pathname: b.pathname, uploader, uploadedAt: b.uploadedAt });
  }
  // Newest first, with pathname as a stable tiebreaker so a batch uploaded at the
  // same instant always returns in the SAME order (no shuffling cover photo).
  for (const d of Object.keys(byDate)) byDate[d].sort((a, b) =>
    String(b.uploadedAt).localeCompare(String(a.uploadedAt)) || String(a.pathname).localeCompare(String(b.pathname)));
  return { configured: true, byDate };
}

// Server-side upload: browser sends a downscaled base64 image, we put() it to Blob.
export async function uploadPhoto({ date, name, filename, contentType, data }) {
  if (!blobConfigured()) throw new Error('uploads not configured');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('valid date required');
  if (!String(name || '').trim()) throw new Error('name required');
  if (!data) throw new Error('no image data');
  const ct = ['image/jpeg', 'image/png', 'image/webp'].includes(contentType) ? contentType : 'image/jpeg';
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > 10 * 1024 * 1024) throw new Error('image too large');
  const pathname = `${PREFIX}${date}/${slug(name)}__${safeFile(filename)}`;
  const { url } = await put(pathname, buffer, { access: 'public', contentType: ct, addRandomSuffix: true });
  return { url };
}

export async function deletePhoto(url) {
  if (!url) throw new Error('url required');
  await del(url);
}

// Move an uploaded photo to a different session date: copy to the new
// sessions/<toDate>/ path (keeping the same filename so the uploader tag and
// random suffix survive), then delete the original. Blob has no native rename.
export async function movePhoto(url, toDate) {
  if (!blobConfigured()) throw new Error('uploads not configured');
  if (!url) throw new Error('url required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate || '')) throw new Error('valid target date required');
  const path = new URL(url).pathname.replace(/^\/+/, '').split('/'); // sessions/<date>/<file...>
  const file = path.slice(2).join('/');
  if (path[0] !== 'sessions' || !file) throw new Error('not a session photo');
  if (path[1] === toDate) return { url }; // already there
  const toPathname = `${PREFIX}${toDate}/${file}`;
  const { url: newUrl } = await copy(url, toPathname, { access: 'public', addRandomSuffix: false });
  await del(url);
  return { url: newUrl };
}
