// The /api/* endpoints only exist when the dashboard is served by the Node
// server (`npm start`) or the Vite dev server. A plain static deploy (Vercel,
// GitHub Pages, `vite preview`) has no backend: the SPA fallback answers /api
// with index.html, so `r.json()` throws and the UI used to show a permanent
// "Could not load polls" error as if something were broken.
//
// Detect that case explicitly so the UI can say "read-only deployment" instead.

export class ApiUnavailableError extends Error {
  constructor(message = 'API not available on this deployment') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

function looksLikeJson(res) {
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json');
}

export async function getJson(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    // Network-level failure — the server may exist but be unreachable.
    throw err;
  }
  // A static host answers an unknown /api path with the SPA shell (200 + HTML)
  // or a 404 page; neither is this API.
  if (!looksLikeJson(res)) throw new ApiUnavailableError();
  if (res.status === 404 || res.status === 405) throw new ApiUnavailableError();
  return res.json();
}
