// Session photo uploads, backed by Vercel Blob. Committed photos in
// public/sessions/<date>/ are baked in at build time; these are the runtime
// uploads anyone can add from the gathering. They live under sessions/<date>/
// in Blob and the Sessions gallery merges both sources by date.
//
// Needs BLOB_READ_WRITE_TOKEN (auto-injected on Vercel once you add a Blob
// store; for local dev put it in .env.local). Without it, listing returns
// empty + uploads report "not configured".
import { list, del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';

const PREFIX = 'sessions/';
const deslug = (s) => s.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  // newest upload first within each date
  for (const d of Object.keys(byDate)) byDate[d].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return { configured: true, byDate };
}

// Client-upload token flow (browser uploads straight to Blob; this only authorizes it).
export async function generateUploadToken({ body, request }) {
  return handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(PREFIX)) throw new Error('invalid path');
      return {
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'],
        maximumSizeInBytes: 15 * 1024 * 1024,
        addRandomSuffix: true,
      };
    },
    onUploadCompleted: async () => {}, // Vercel calls this post-upload in prod; no-op
  });
}

export async function deletePhoto(url) {
  if (!url) throw new Error('url required');
  await del(url);
}
