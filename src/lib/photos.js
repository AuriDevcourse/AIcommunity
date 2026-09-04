// One reader for /api/photos, because five components call it and every one of
// them used to swallow a failure into an empty object.
//
// The failure that actually bites: `vite preview` serves dist/ with no
// serverless functions, so /api/photos answers **200 with index.html**. That is
// not an error to fetch(), and r.json() throws a parse error that reads like
// nothing in particular. The sessions whose photos are committed under
// public/sessions/ keep rendering, so the page looks healthy while exactly the
// Blob-only sessions (2026-05-31 and 2026-06-14) go silently empty, which looks
// like data loss and is not.
//
// So: name that case, and let the caller decide whether to show it.

import { authedFetch, accessToken, authEnabled } from './supabase.js';

export const PHOTOS_ENDPOINT = '/api/photos';

export class PhotosUnavailable extends Error {
  constructor(reason, detail) {
    super(detail);
    this.name = 'PhotosUnavailable';
    this.reason = reason; // 'no-api' | 'http' | 'bad-json' | 'auth'
  }
}

// Resolves to { configured, byDate }. Throws PhotosUnavailable, never a bare
// SyntaxError, so a caller can tell "no uploads yet" from "the API is not here".
export async function fetchPhotos(signal) {
  // The archive is members-only. Signed out (with auth configured) the answer is
  // a 401 every time, so skip the round trip and the red line in the console.
  if (authEnabled && !(await accessToken())) throw new PhotosUnavailable('auth', 'photos API needs a signed-in member');
  let r;
  try {
    // The request carries the session token.
    r = await authedFetch(PHOTOS_ENDPOINT, { signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new PhotosUnavailable('no-api', `photos request failed: ${e?.message || e}`);
  }
  const type = r.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    // The SPA fallback. A 200 here means no function is mounted on the route.
    throw new PhotosUnavailable('no-api',
      `photos API returned ${type || 'no content-type'} (HTTP ${r.status}). On \`vite preview\` there are no serverless functions; use \`npm run dev\` instead.`);
  }
  if (r.status === 401) throw new PhotosUnavailable('auth', 'photos API needs a signed-in member');
  if (!r.ok) throw new PhotosUnavailable('http', `photos API returned HTTP ${r.status}`);
  let j;
  try {
    j = await r.json();
  } catch (e) {
    throw new PhotosUnavailable('bad-json', `photos API sent unparseable JSON: ${e?.message || e}`);
  }
  return { configured: j?.configured !== false, byDate: j?.byDate || {} };
}

// For the callers that only need the map and have nothing useful to say when it
// is missing. Still warns, so the reason is one console line away instead of
// invisible.
export async function fetchPhotosByDate(signal) {
  try {
    return (await fetchPhotos(signal)).byDate;
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    if (e?.reason !== 'auth') console.warn('[photos]', e.message); // signed out is expected, not a fault
    return {};
  }
}
