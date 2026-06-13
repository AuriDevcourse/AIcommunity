import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FEEDBACK_FILE = join(process.cwd(), 'data', 'feedback.md');
const POLL_FILE = join(process.cwd(), 'data', 'poll.json');

const TEXT_MAX = 200;
const QUESTION_MAX = 200;
const SUBTITLE_MAX = 400;
const NAME_MAX = 64;
const MAX_OPTIONS_PER_POLL = 50;
const MAX_POLLS = 30;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 65536) reject(new Error('payload too large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function readState() {
  if (!existsSync(POLL_FILE)) return { polls: [] };
  const raw = JSON.parse(readFileSync(POLL_FILE, 'utf8'));
  return raw && Array.isArray(raw.polls) ? raw : { polls: [] };
}

function writeState(state) {
  writeFileSync(POLL_FILE, JSON.stringify(state, null, 2));
}

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

function withTallies(poll) {
  const latestByName = new Map();
  for (const v of poll.votes) latestByName.set(normName(v.name), v);
  const counts = new Map();
  const voters = new Map();
  for (const v of latestByName.values()) {
    counts.set(v.optionId, (counts.get(v.optionId) || 0) + 1);
    if (!voters.has(v.optionId)) voters.set(v.optionId, []);
    voters.get(v.optionId).push(v.name);
  }
  const options = poll.options.map((o) => ({
    ...o,
    votes: counts.get(o.id) || 0,
    voters: voters.get(o.id) || [],
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: poll.id,
    question: poll.question,
    subtitle: poll.subtitle,
    createdBy: poll.createdBy,
    createdAt: poll.createdAt,
    allowSuggestions: poll.allowSuggestions !== false,
    options,
  };
}

function withAllTallies(state) {
  return {
    polls: state.polls
      .map(withTallies)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function makeId(text, prefix) {
  const slug = String(text).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
  return `${slug || prefix || 'item'}-${Date.now().toString(36)}`;
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

function pollPlugin() {
  return {
    name: 'poll-api',
    configureServer(server) {
      server.middlewares.use('/api/poll', async (req, res) => {
        const send = (status, payload) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };
        try {
          const url = req.url || '/';
          // GET /api/poll → list all polls with tallies
          if (req.method === 'GET' && (url === '/' || url === '')) {
            return send(200, withAllTallies(readState()));
          }
          // POST /api/poll → create a new poll { question, subtitle?, allowSuggestions?, name }
          if (req.method === 'POST' && (url === '/' || url === '')) {
            const body = JSON.parse((await readBody(req)) || '{}');
            const question = String(body.question || '').trim().slice(0, QUESTION_MAX);
            const subtitle = String(body.subtitle || '').trim().slice(0, SUBTITLE_MAX);
            const name = String(body.name || '').trim().slice(0, NAME_MAX);
            const allowSuggestions = body.allowSuggestions !== false;
            if (!question || !name) return send(400, { ok: false, error: 'question and name required' });
            const state = readState();
            if (state.polls.length >= MAX_POLLS) return send(400, { ok: false, error: 'poll limit reached' });
            const poll = {
              id: makeId(question, 'poll'),
              question,
              subtitle,
              createdBy: name,
              createdAt: new Date().toISOString(),
              allowSuggestions,
              options: [],
              votes: [],
            };
            state.polls.push(poll);
            writeState(state);
            return send(200, { ok: true, pollId: poll.id, state: withAllTallies(state) });
          }
          // DELETE /api/poll/{pollId} → creator-only
          let m = url.match(/^\/([^/]+)$/);
          if (req.method === 'DELETE' && m) {
            const pollId = m[1];
            const body = JSON.parse((await readBody(req)) || '{}');
            const name = String(body.name || '').trim().slice(0, NAME_MAX);
            if (!name) return send(400, { ok: false, error: 'name required' });
            const state = readState();
            const idx = state.polls.findIndex((p) => p.id === pollId);
            if (idx === -1) return send(404, { ok: false, error: 'poll not found' });
            if (normName(name) !== normName(state.polls[idx].createdBy)) {
              return send(403, { ok: false, error: 'only the creator can delete this poll' });
            }
            state.polls.splice(idx, 1);
            writeState(state);
            return send(200, { ok: true, state: withAllTallies(state) });
          }
          // POST /api/poll/{pollId}/option → { text, name }
          m = url.match(/^\/([^/]+)\/option$/);
          if (req.method === 'POST' && m) {
            const pollId = m[1];
            const body = JSON.parse((await readBody(req)) || '{}');
            const text = String(body.text || '').trim().slice(0, TEXT_MAX);
            const name = String(body.name || '').trim().slice(0, NAME_MAX);
            if (!text || !name) return send(400, { ok: false, error: 'text and name required' });
            const state = readState();
            const poll = state.polls.find((p) => p.id === pollId);
            if (!poll) return send(404, { ok: false, error: 'poll not found' });
            if (!poll.allowSuggestions && normName(name) !== normName(poll.createdBy)) {
              return send(403, { ok: false, error: 'this poll does not accept suggestions' });
            }
            if (poll.options.length >= MAX_OPTIONS_PER_POLL) return send(400, { ok: false, error: 'option limit reached' });
            const dupe = poll.options.find((o) => o.text.trim().toLowerCase() === text.toLowerCase());
            if (dupe) return send(200, { ok: true, duplicate: true, optionId: dupe.id, state: withAllTallies(state) });
            const option = { id: makeId(text, 'opt'), text, createdBy: name, createdAt: new Date().toISOString() };
            poll.options.push(option);
            writeState(state);
            return send(200, { ok: true, optionId: option.id, state: withAllTallies(state) });
          }
          // DELETE /api/poll/{pollId}/vote → clear all votes by { name } in this poll
          m = url.match(/^\/([^/]+)\/vote$/);
          if (req.method === 'DELETE' && m) {
            const pollId = m[1];
            const body = JSON.parse((await readBody(req)) || '{}');
            const name = String(body.name || '').trim().slice(0, NAME_MAX);
            if (!name) return send(400, { ok: false, error: 'name required' });
            const state = readState();
            const poll = state.polls.find((p) => p.id === pollId);
            if (!poll) return send(404, { ok: false, error: 'poll not found' });
            const nn = normName(name);
            poll.votes = poll.votes.filter((v) => normName(v.name) !== nn);
            writeState(state);
            return send(200, { ok: true, state: withAllTallies(state) });
          }
          // POST /api/poll/{pollId}/vote → { optionId, name }
          if (req.method === 'POST' && m) {
            const pollId = m[1];
            const body = JSON.parse((await readBody(req)) || '{}');
            const optionId = String(body.optionId || '').trim();
            const name = String(body.name || '').trim().slice(0, NAME_MAX);
            if (!optionId || !name) return send(400, { ok: false, error: 'optionId and name required' });
            const state = readState();
            const poll = state.polls.find((p) => p.id === pollId);
            if (!poll) return send(404, { ok: false, error: 'poll not found' });
            if (!poll.options.find((o) => o.id === optionId)) return send(404, { ok: false, error: 'option not found' });
            poll.votes.push({ optionId, name, ts: new Date().toISOString() });
            writeState(state);
            return send(200, { ok: true, state: withAllTallies(state) });
          }
          return send(405, { ok: false, error: 'method not allowed' });
        } catch (e) {
          return send(500, { ok: false, error: e.message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), feedbackPlugin(), pollPlugin()],
  server: {
    port: 5280,
    open: true,
    strictPort: true,
    watch: {
      // Runtime API state — written by the dev middlewares on every interaction.
      // Without this, Vite full-reloads the page on every vote / feedback submit.
      ignored: ['**/data/poll.json', '**/data/feedback.md'],
    },
  },
});
