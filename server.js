// Production server: serves built dist/ and handles /api/* routes.
// Mirrors the dev-only Vite middleware in vite.config.js so feedback (and future
// RSVP / topic-vote endpoints) work in production.

import express from 'express';
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
app.use(express.json({ limit: '64kb' }));

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

app.use(express.static(DIST_DIR, { index: 'index.html', maxAge: '1h' }));
app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`aiworkshop listening on :${PORT}`);
});
