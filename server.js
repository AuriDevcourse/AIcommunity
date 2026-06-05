// Production server: serves built dist/ and handles /api/* routes.
// Mirrors the dev-only Vite middleware in vite.config.js so feedback (and future
// RSVP / topic-vote endpoints) work in production.

import express from 'express';
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
import { guardMutation } from './api/_guard.js';

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
const FEEDBACK_FILE = join(DATA_DIR, 'feedback.md');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(FEEDBACK_FILE)) {
  writeFileSync(FEEDBACK_FILE, '# AI Workshop — Feedback Log\n\nCaptured via the dashboard\'s feedback button. Reviewed at quarterly health check.\n\n---\n');
}

const app = express();
app.use(express.json({ limit: '12mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/feedback', (_req, res) => {
  const md = existsSync(FEEDBACK_FILE) ? readFileSync(FEEDBACK_FILE, 'utf8') : '';
  const entries = [...md.matchAll(/^## (.+?)\n\*\*(.+?)\*\* — (.+?)\n\n([\s\S]*?)(?=\n---|\n## |$)/gm)]
    .map((m) => ({ timestamp: m[1], category: m[2], from: m[3], text: m[4].trim() }));
  res.json({ entries: entries.reverse() });
});

app.post('/api/feedback', (req, res) => {
  try {
    const { text, category = 'general', from = 'anon' } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'empty text' });
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const safeText = text.trim().replace(/\r/g, '').slice(0, 4000);
    const safeCategory = String(category).slice(0, 32);
    const safeFrom = String(from || 'anon').slice(0, 64);
    const entry = `\n## ${ts}\n**${safeCategory}** — ${safeFrom}\n\n${safeText}\n\n---\n`;
    appendFileSync(FEEDBACK_FILE, entry);
    res.json({ ok: true, timestamp: ts });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.all('/api/polls', async (req, res) => {
  try {
    if (await gate(req, res, 'polls', 60)) return;
    const { status, json } = await handlePolls({ method: req.method, body: req.body });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/polls error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.get('/api/attendees', async (req, res) => {
  const { status, json } = await handleAttendees({ query: req.query || {} });
  res.status(status).json(json);
});


app.all('/api/threads', async (req, res) => {
  try {
    if (await gate(req, res, 'threads', 60)) return;
    const { status, json } = await handleThreads({ method: req.method, body: req.body, query: req.query });
    res.status(status).json(json);
  } catch (e) {
    console.error('/api/threads error:', e);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.all('/api/topics', async (req, res) => {
  try {
    if (await gate(req, res, 'topics', 30)) return;
    const { status, json } = await handleTopics({ method: req.method, body: req.body });
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
app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`aiworkshop listening on :${PORT}`);
});
