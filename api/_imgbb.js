// Image/GIF upload proxy via ImgBB (free). The API key stays server-side; the
// client sends a base64 image and gets back a hosted URL. Used by the forum and
// session discussion composers.
// Read at call time, not module load: vite.config imports this before it loads
// .env.local into process.env, so a module-level const would capture an empty key.
export function imgbbConfigured() { return Boolean(process.env.IMGBB_API_KEY); }

export async function handleImageUpload({ body }) {
  const KEY = process.env.IMGBB_API_KEY || '';
  if (!KEY) return { status: 200, json: { ok: false, configured: false, error: 'Image upload not configured. Add IMGBB_API_KEY.' } };

  const image = String(body?.image || '');
  if (!image) return { status: 400, json: { ok: false, error: 'no image data' } };
  // Guard payload size (base64). ~4MB base64 ≈ 3MB file, stays under serverless limits.
  if (image.length > 4_400_000) return { status: 413, json: { ok: false, error: 'Image too large (max ~3MB).' } };

  const form = new URLSearchParams();
  form.set('key', KEY);
  form.set('image', image);
  if (body?.name) form.set('name', String(body.name).slice(0, 80));

  try {
    const r = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data?.url) {
      // Same rule as the post maker: the upstream's message is for the log.
      console.error('imgbb upload failed:', j?.error?.message || `imgbb ${r.status}`);
      return { status: 502, json: { ok: false, error: 'The image host rejected that upload. Try again in a moment.' } };
    }
    return { status: 200, json: { ok: true, url: j.data.url, width: j.data.width, height: j.data.height } };
  } catch (e) {
    return { status: 502, json: { ok: false, error: e.message } };
  }
}
