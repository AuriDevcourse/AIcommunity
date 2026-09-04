// Production server: serves built dist/ and handles /api/* routes.
// Mirrors the dev-only Vite middleware in vite.config.js so the API routes work
// in production.

import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePolls } from './api/_polls-core.js';
import { handleAttendees } from './api/_gcal.js';
import { listPhotos, uploadPhoto, deletePhoto, movePhoto, blobConfigured } from './api/_photos.js';
import { handleGeneratePost } from './api/_postmaker.js';
import { handleThreads } from './api/_threads.js';
import { handleTopics } from './api/_topics.js';
import { handleSessionMeta } from './api/_session-meta.js';
import { handleImageUpload } from './api/_imgbb.js';
import { guardMutation, requireUser } from './api/_guard.js';

// The verified caller for a mutating request, mirroring api/*.js and the Vite
// middleware. Returns { sent: true } when it has already answered, otherwise the
// user (null in typed-name mode, when Supabase is not configured).
async function whoFor(req, res) {
  if (req.method === 'GET') return { user: null };
  const u = await requireUser(req);
  if (u.blocked) { res.status(u.blocked.status).json(u.blocked.json); return { sent: true }; }
  return { user: u.user || null };
}

// Gate mutating requests (auth + rate limit). Returns true if it already responded.
async function gate(req, res, bucket, limit) {
  if (req.method === 'GET') return false;
  const blocked = await guardMutation(req, { bucket, limit });
  if (blocked) { res.status(blocked.status).json(blocked.json); return true; }
  return false;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3003', 10);
const DIST_DIR = join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const app = express();
app.use(express.json({ limit: '12mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/attendees', async (req, res) => {
  const { status, json } = await handleAttendees({ query: req.query || {} });
  res.status(status).json(json);
});


app.all('/api/threads', async (req, res) => {
  try {
    if (await gate(req, res, 'threads', 60)) return;
    const who = await whoFor(req, res);
    if (who.sent) return;
    const { status, json } = await handleThreads({ method: req.method, body: req.body, query: req.query, user: who.user });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/threads error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.all('/api/topics', async (req, res) => {
  try {
    if (await gate(req, res, 'topics', 30)) return;
    const who = await whoFor(req, res);
    if (who.sent) return;
    const { status, json } = await handleTopics({ method: req.method, body: req.body, user: who.user });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/topics error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.all('/api/session-meta', async (req, res) => {
  try {
    if (await gate(req, res, 'session-meta', 60)) return;
    const { status, json } = await handleSessionMeta({ method: req.method, body: req.body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/session-meta error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.post('/api/upload-image', async (req, res) => {
  try {
    if (await gate(req, res, 'upload-image', 30)) return;
    const { status, json } = await handleImageUpload({ body: req.body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/upload-image error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.post('/api/generate-post', async (req, res) => {
  try {
    if (await gate(req, res, 'generate-post', 10)) return;
    const { status, json } = await handleGeneratePost({ body: req.body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/generate-post error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.all('/api/photos', async (req, res) => {
  try {
    if (req.method === 'GET') return res.status(200).json(await listPhotos());
    if (await gate(req, res, 'photos', 40)) return;
    if (!blobConfigured()) return res.status(200).json({ ok: false, configured: false, error: 'uploads not configured' });
    if (req.method === 'POST') { const r = await uploadPhoto(req.body); return res.status(200).json({ ok: true, ...r }); }
    if (req.method === 'DELETE') { await deletePhoto(req.query?.url || ''); return res.status(200).json({ ok: true }); }
    if (req.method === 'PATCH') { const r = await movePhoto(req.body?.url, req.body?.toDate); return res.status(200).json({ ok: true, ...r }); }
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('/api/photos error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.use(express.static(DIST_DIR, { index: 'index.html', maxAge: '1h' }));

// An unknown API path is an error, not a page. Without this the SPA fallback
// below answered /api/anything with 200 and an HTML shell, so a client fetch saw
// a success it could not parse instead of a 404 it could handle.
app.all('/api/*', (req, res) => {
  res.status(404).json({ ok: false, error: `No such API route: ${req.method} ${req.path}` });
});

app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ai-sundays listening on :${PORT}`);
});
