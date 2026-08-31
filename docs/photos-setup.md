# Session photo uploads, setup

Lets anyone at a gathering upload photos straight from the website (Sessions tab → **Add photos**). Each photo is tagged with the uploader's name; you can delete any of them. Uploaded photos merge into the Sessions gallery alongside the committed ones in `public/sessions/`.

## Why it needs a store
Vercel's filesystem is read-only at runtime, so uploads can't be written into the repo. They go to **Vercel Blob** (object storage), and the gallery merges committed + uploaded photos by date. Phone photos can be several MB, so the browser uploads **directly to Blob** (client upload), the serverless function only hands out a short-lived upload token, it never proxies the file (avoids the 4.5MB function body limit).

## One-time setup (Vercel)
1. Vercel dashboard → your project → **Storage** → **Create** → **Blob**. Accept the free plan and connect it to the project.
2. Vercel auto-injects **`BLOB_READ_WRITE_TOKEN`** into the project env (all environments).
3. **Redeploy** so the functions pick it up.

That's it. Until the store exists, the Add-photos panel shows "uploads aren't connected yet" and the gallery just shows the committed photos.

## Local development
To test uploads locally, pull the token into `.env.local`:
```
vercel env pull .env.local        # writes BLOB_READ_WRITE_TOKEN (among others)
```
or paste `BLOB_READ_WRITE_TOKEN=...` from the Vercel dashboard. Then `npm run dev` and the uploader works against the real Blob store (same store as prod, uploads are shared, so use a throwaway photo while testing).

## How it works
- `api/_photos.js`, shared: `listPhotos()` (lists Blob, groups by `sessions/<date>/`), `generateUploadToken()` (Blob client-upload handshake), `deletePhoto(url)`.
- `api/photos.js`. Vercel function: `GET` list · `POST` upload token · `DELETE ?url=` remove. Mirrored in `vite.config.js` + `server.js`.
- `src/components/PhotoUploader.jsx`, name + session date + multi-file picker, uploads via `@vercel/blob/client`, shows that date's photos with delete.
- `src/components/SessionsGallery.jsx`, fetches `/api/photos`, merges uploads into each session by date (and creates a tile for any date that has only uploaded photos).

## Notes
- Photos are stored at `sessions/<date>/<uploader>__<file>-<random>.<ext>`; the uploader name is parsed back out of the path for the credit chip.
- Allowed: jpeg, png, webp, gif, heic/heif, up to 15MB each. HEIC may not preview in some browsers, most phone shares already convert to JPEG.
- Moderation: it's name-tagged, not locked. Anyone with the site can upload/delete. Fine for a trusted ~15-person group; if it's ever abused, gate the upload endpoint behind a shared passphrase.
- These uploads are independent of `public/sessions/`, committed photos still work and need no store.
