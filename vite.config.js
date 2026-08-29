import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
import { createApi, routePoll } from './src/server/api.js';

// The dev server shares src/server/api.js with production server.js, so
// validation, limits and auth behave identically in both. Previously these were
// two hand-maintained copies that had already drifted.
const api = createApi({ dataDir: join(process.cwd(), 'data') });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 65536) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      body += c;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function clientIp(req) {
  return req.socket?.remoteAddress || 'local';
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function feedbackPlugin() {
  return {
    name: 'feedback-api',
    configureServer(server) {
      server.middlewares.use('/api/feedback', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const { status, body } = await api.getFeedback({ ip: clientIp(req) });
            return send(res, status, body);
          }
          if (req.method === 'POST') {
            const parsed = JSON.parse((await readBody(req)) || '{}');
            const { status, body } = await api.postFeedback({ body: parsed, ip: clientIp(req) });
            return send(res, status, body);
          }
          return send(res, 405, { ok: false, error: 'method not allowed' });
        } catch (e) {
          console.error('feedback api error:', e);
          return send(res, 500, { ok: false, error: 'internal error' });
        }
      });
    },
  };
}

// Substitutes %VITE_SITE_URL% in index.html, defaulting to an empty origin so
// the tags degrade to relative paths rather than shipping the raw token.
function siteUrlHtml() {
  return {
    name: 'site-url-html',
    transformIndexHtml(html) {
      const origin = (process.env.VITE_SITE_URL || '').replace(/\/+$/, '');
      return html.replaceAll('%VITE_SITE_URL%', origin);
    },
  };
}

function pollPlugin() {
  return {
    name: 'poll-api',
    configureServer(server) {
      server.middlewares.use('/api/poll', async (req, res) => {
        try {
          const route = routePoll(req.method, req.url || '/');
          if (!route) return send(res, 405, { ok: false, error: 'method not allowed' });
          const needsBody = req.method === 'POST' || req.method === 'DELETE';
          const parsed = needsBody ? JSON.parse((await readBody(req)) || '{}') : {};
          const { status, body } = await api[route.handler]({
            params: route.params,
            body: parsed,
            ip: clientIp(req),
            token: String(req.headers['x-voter-token'] || '').trim(),
          });
          return send(res, status, body);
        } catch (e) {
          console.error('poll api error:', e);
          return send(res, 500, { ok: false, error: 'internal error' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Area 10.3 — without a default, an unset VITE_SITE_URL would ship the literal
  // "%VITE_SITE_URL%" into the meta tags.
  define: {},
  plugins: [react(), feedbackPlugin(), pollPlugin(), siteUrlHtml(mode)],
  server: {
    // Bind IPv4 explicitly. Vite's default "localhost" resolves to ::1 only on
    // this machine, while Chrome resolves localhost → 127.0.0.1 — the mismatch
    // shows up as ERR_CONNECTION_REFUSED even though the server is running.
    //
    // Loopback-only is deliberate: the /api middlewares below have no auth, so
    // binding the LAN by default would expose poll writes to the whole network.
    // To test from a phone, opt in per-run: `npm run dev -- --host` (the CLI
    // flag overrides this value). `preview` inherits this host automatically.
    host: '127.0.0.1',
    port: 5280,
    open: true,
    // Fail loudly on a port clash instead of silently moving to :5281, which
    // would leave the opened tab pointing at the wrong (or a stale) server.
    strictPort: true,
    watch: {
      // Runtime API state — written by the dev middlewares on every interaction.
      // Without this, Vite full-reloads the page on every vote / feedback submit.
      ignored: ['**/data/poll.json', '**/data/feedback.md'],
    },
  },
}));
