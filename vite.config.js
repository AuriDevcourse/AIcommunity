import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
// NB: the API handlers read process.env at module-eval time (KV/Upstash creds).
// They're imported dynamically inside configureServer, which runs *after* the
// loadEnv() below populates process.env, so the dev middleware sees the same
// Upstash store as production instead of falling back to the local file store.


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
    async configureServer(server) {
      // Loaded here (post-loadEnv) so the modules' top-level env reads succeed.
      const [
        { handlePolls },
        { handleAttendees, listUpcomingSessions },
        { listPhotos, uploadPhoto, deletePhoto, movePhoto, blobConfigured },
        { handleGeneratePost, streamPostToRes, postmakerConfigured },
        { handleThreads },
        { handleTopics },
        { handleImageUpload },
        { handleSessionMeta },
        { handleRsvpGet, handleRsvpPost },
        { guardMutation, requireUser },
      ] = await Promise.all([
        import('./api/_polls-core.js'),
        import('./api/_gcal.js'),
        import('./api/_photos.js'),
        import('./api/_postmaker.js'),
        import('./api/_threads.js'),
        import('./api/_topics.js'),
        import('./api/_imgbb.js'),
        import('./api/_session-meta.js'),
        import('./api/_rsvp.js'),
        import('./api/_guard.js'),
      ]);
      // Gate mutating requests (auth + rate limit) before running the handler.
      const gate = async (req, res, bucket, limit) => {
        if (req.method === 'GET') return false;
        const blocked = await guardMutation(req, { bucket, limit });
        if (blocked) { sendJson(res, blocked.status, blocked.json); return true; }
        return false;
      };
      // The verified caller for a mutating request, mirroring api/*.js. Returns
      // { sent: true } when it has already answered the request, otherwise the
      // user (null in typed-name mode, when Supabase is not configured).
      const whoFor = async (req, res) => {
        const u = await requireUser(req);
        if (u.blocked) { sendJson(res, u.blocked.status, u.blocked.json); return { sent: true }; }
        return { user: u.user || null };
      };
      server.middlewares.use('/api/polls', async (req, res) => {
        try {
          if (await gate(req, res, 'polls', 60)) return;
          let user = null;
          if (req.method !== 'GET') {
            const who = await whoFor(req, res);
            if (who.sent) return;
            user = who.user;
          }
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handlePolls({ method: req.method, body, user });
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
      server.middlewares.use('/api/threads', async (req, res) => {
        try {
          if (await gate(req, res, 'threads', 60)) return;
          let user = null;
          if (req.method !== 'GET') {
            const who = await whoFor(req, res);
            if (who.sent) return;
            user = who.user;
          }
          const url = new URL(req.url, 'http://localhost');
          const query = Object.fromEntries(url.searchParams);
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handleThreads({ method: req.method, body, query, user });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/topics', async (req, res) => {
        try {
          if (await gate(req, res, 'topics', 30)) return;
          let user = null;
          if (req.method !== 'GET') {
            const who = await whoFor(req, res);
            if (who.sent) return;
            user = who.user;
          }
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handleTopics({ method: req.method, body, user });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/rsvp', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const query = Object.fromEntries(url.searchParams);
            const { status, json } = await handleRsvpGet({ query });
            return sendJson(res, status, json);
          }
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
          if (await gate(req, res, 'rsvp', 30)) return;
          const u = await requireUser(req);
          if (u.configured === false) return sendJson(res, 200, { ok: false, configured: false });
          if (u.blocked) return sendJson(res, u.blocked.status, u.blocked.json);
          const body = await readJsonBody(req);
          const { status, json } = await handleRsvpPost({ body, user: u.user });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/schedule', async (req, res) => {
        try {
          if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
          const data = await listUpcomingSessions({});
          sendJson(res, 200, data.configured === false ? { configured: false } : { ok: true, ...data });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/session-meta', async (req, res) => {
        try {
          if (await gate(req, res, 'session-meta', 60)) return;
          const body = req.method === 'POST' ? await readJsonBody(req) : {};
          const { status, json } = await handleSessionMeta({ method: req.method, body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/upload-image', async (req, res) => {
        try {
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
          if (await gate(req, res, 'upload-image', 30)) return;
          const body = await readJsonBody(req);
          const { status, json } = await handleImageUpload({ body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/generate-post', async (req, res) => {
        try {
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
          if (await gate(req, res, 'generate-post', 10)) return;
          const body = await readJsonBody(req);
          if (body.stream) {
            if (!postmakerConfigured()) return sendJson(res, 200, { ok: false, configured: false });
            if (!String(body.notes || '').trim()) return sendJson(res, 400, { ok: false, error: 'notes required' });
            return streamPostToRes(res, body);
          }
          const { status, json } = await handleGeneratePost({ body });
          sendJson(res, status, json);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
      server.middlewares.use('/api/photos', async (req, res) => {
        try {
          if (req.method === 'GET') return sendJson(res, 200, await listPhotos());
          if (await gate(req, res, 'photos', 40)) return;
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
          if (req.method === 'PATCH') {
            const body = await readJsonBody(req);
            const r = await movePhoto(body.url, body.toDate);
            return sendJson(res, 200, { ok: true, ...r });
          }
          return sendJson(res, 405, { ok: false, error: 'method not allowed' });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e.message });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env / .env.local (all keys, not just VITE_) into process.env so the
  // dev API middleware can read GCAL_* secrets the same way the server does.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), pollsPlugin()],
    server: {
      // Bind IPv4 loopback explicitly. Left to its default, Vite listened on
      // [::1] only, so http://localhost worked but http://127.0.0.1 was refused
      // outright, and scripts/{smoke,theme-check,capture}.mjs all default to
      // 127.0.0.1, so they silently pointed at nothing and failed as if the app
      // were broken. Both names resolve here now.
      host: '127.0.0.1',
      port: 5280,
      open: true,
      strictPort: true,
      // Local API stores live under data/. Don't trigger a full page reload when
      // a poll/suggestion/thread write touches them (prod uses Upstash, not files).
      watch: { ignored: ['**/data/*-store.json'] },
    },
  };
});
