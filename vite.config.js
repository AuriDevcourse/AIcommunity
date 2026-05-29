import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { handlePolls } from './api/_polls-core.js';
import { handleAttendees } from './api/_gcal.js';
import { listPhotos, uploadPhoto, deletePhoto, blobConfigured } from './api/_photos.js';
import { handleGeneratePost } from './api/_postmaker.js';
import { handleSuggestions } from './api/_suggestions.js';

const FEEDBACK_FILE = join(process.cwd(), 'data', 'feedback.md');

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function sendJson(res, status, json) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(json));
}

function pollsPlugin() {
  return {
    name: 'polls-api',
    configureServer(server) {
      server.middlewares.use('/api/polls', async (req, res) => {
        try {
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handlePolls({ method: req.method, body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/attendees', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = Object.fromEntries(url.searchParams);
          const { status, json } = await handleAttendees({ query });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/suggestions', async (req, res) => {
        try {
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handleSuggestions({ method: req.method, body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/generate-post', async (req, res) => {
        try {
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
          const body = await readJsonBody(req);
          const { status, json } = await handleGeneratePost({ body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/photos', async (req, res) => {
        try {
          if (req.method === 'GET') return sendJson(res, 200, await listPhotos());
          if (!blobConfigured()) return sendJson(res, 200, { ok: false, configured: false, error: 'uploads not configured' });
          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const r = await uploadPhoto(body);
            return sendJson(res, 200, { ok: true, ...r });
          }
          if (req.method === 'DELETE') {
            const url = new URL(req.url, 'http://localhost');
            await deletePhoto(url.searchParams.get('url') || '');
            return sendJson(res, 200, { ok: true });
          }
          return sendJson(res, 405, { ok: false, error: 'method not allowed' });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
    },
  };
}

function feedbackPlugin() {
  return {
    name: 'feedback-api',
    configureServer(server) {
      server.middlewares.use('/api/feedback', (req, res) => {
        if (req.method === 'GET') {
          const md = existsSync(FEEDBACK_FILE) ? readFileSync(FEEDBACK_FILE, 'utf8') : '';
          const entries = [...md.matchAll(/^## (.+?)\n\*\*(.+?)\*\* — (.+?)\n\n([\s\S]*?)(?=\n---|\n## |$)/gm)]
            .map((m) => ({ timestamp: m[1], category: m[2], from: m[3], text: m[4].trim() }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ entries: entries.reverse() }));
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const { text, category = 'general', from = 'anon' } = JSON.parse(body);
              if (!text || typeof text !== 'string' || text.trim().length === 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'empty text' }));
                return;
              }
              const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
              const safeText = text.trim().replace(/\r/g, '');
              const entry = `\n## ${ts}\n**${category}** — ${from || 'anon'}\n\n${safeText}\n\n---\n`;
              appendFileSync(FEEDBACK_FILE, entry);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, timestamp: ts }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env / .env.local (all keys, not just VITE_) into process.env so the
  // dev API middleware can read GCAL_* secrets the same way the server does.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), feedbackPlugin(), pollsPlugin()],
    server: { port: 5280, open: true, strictPort: true },
  };
});
