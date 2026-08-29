// Production server: serves the built dist/ and handles /api/*.
//
// All request logic lives in src/server/api.js, shared verbatim with the Vite
// dev middleware in vite.config.js — this file is only transport + static.

import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi, routePoll } from './src/server/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');

const api = createApi({ dataDir: DATA_DIR });

const app = express();

// Area 10.2 — the JSON payloads and the HTML shell compress well and this is a
// single small box, so the CPU trade is trivially worth it.
app.use(compression());

// Area 10.1 — this app has no inline event handlers and loads no third-party
// origins, so a strict CSP costs nothing and closes off injected-script and
// clickjacking classes outright. 'unsafe-inline' stays only for styles, which
// Tailwind's injected style element and our inline avatar gradients require.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Only meaningful over TLS, and harmful if sent while still on plain HTTP.
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Area 10.8 — one line per request, so a 500 has context in the journal.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/healthz') return;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});
// Behind a reverse proxy, req.ip must come from X-Forwarded-For or every request
// shares one rate-limit bucket. Parsed as a string, never Boolean() — the latter
// makes TRUST_PROXY="false" evaluate to true, inverting the operator's intent.
// A hop count (not `true`) is used so only the nearest proxy is trusted;
// trusting the whole chain lets a client forge X-Forwarded-For and mint a fresh
// rate-limit bucket per request.
const TRUST_PROXY = (() => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === '') return 1;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (raw.toLowerCase() === 'false') return false;
  if (raw.toLowerCase() === 'true') return 1;
  return raw; // an explicit subnet/IP list, passed through to Express
})();
app.set('trust proxy', TRUST_PROXY);
app.use(express.json({ limit: '64kb' }));

async function send(res, resultPromise) {
  try {
    const { status, body } = await resultPromise;
    res.status(status).json(body);
  } catch (e) {
    console.error('api error:', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Area 10.8 — liveness says the process is up; readiness says it can serve.
app.get('/readyz', (_req, res) => {
  const built = existsSync(join(DIST_DIR, 'index.html'));
  res.status(built ? 200 : 503).json({ ok: built, build: built ? 'present' : 'missing' });
});

app.get('/api/feedback', (req, res) => send(res, api.getFeedback({ ip: req.ip })));
app.post('/api/feedback', (req, res) => send(res, api.postFeedback({ body: req.body, ip: req.ip })));

app.all(/^\/api\/poll(\/.*)?$/, (req, res) => {
  const suffix = req.path.replace(/^\/api\/poll/, '') || '/';
  const route = routePoll(req.method, suffix);
  if (!route) return res.status(405).json({ ok: false, error: 'method not allowed' });
  // Identity travels in a header, never a query string, so it stays out of logs.
  const token = String(req.get('X-Voter-Token') || '').trim();
  return send(res, api[route.handler]({ params: route.params, body: req.body, ip: req.ip, token }));
});

app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not found' }));

// Hashed asset filenames can be cached hard; index.html must not be, or a
// deploy keeps serving the old bundle for an hour.
app.use(
  express.static(DIST_DIR, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

app.get('*', (_req, res) => {
  const indexFile = join(DIST_DIR, 'index.html');
  if (!existsSync(indexFile)) {
    return res.status(503).send('Build missing — run `npm run build` first.');
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexFile);
});

app.listen(PORT, HOST, () => {
  console.log(`aiworkshop listening on ${HOST}:${PORT}`);
});
