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
const POLL_FILE = join(DATA_DIR, 'poll.json');

const TEXT_MAX = 200;
const QUESTION_MAX = 200;
const SUBTITLE_MAX = 400;
const NAME_MAX = 64;
const MAX_OPTIONS_PER_POLL = 50;
const MAX_POLLS = 30;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(FEEDBACK_FILE)) {
  writeFileSync(FEEDBACK_FILE, '# AI Workshop — Feedback Log\n\nCaptured via the dashboard\'s feedback button. Reviewed at quarterly health check.\n\n---\n');
}
if (!existsSync(POLL_FILE)) {
  writeFileSync(POLL_FILE, JSON.stringify({ polls: [] }, null, 2));
}

function readState() {
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

app.get('/api/poll', (_req, res) => {
  try {
    res.json(withAllTallies(readState()));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/poll', (req, res) => {
  try {
    const question = String(req.body?.question || '').trim().slice(0, QUESTION_MAX);
    const subtitle = String(req.body?.subtitle || '').trim().slice(0, SUBTITLE_MAX);
    const name = String(req.body?.name || '').trim().slice(0, NAME_MAX);
    const allowSuggestions = req.body?.allowSuggestions !== false;
    if (!question || !name) return res.status(400).json({ ok: false, error: 'question and name required' });
    const state = readState();
    if (state.polls.length >= MAX_POLLS) return res.status(400).json({ ok: false, error: 'poll limit reached' });
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
    res.json({ ok: true, pollId: poll.id, state: withAllTallies(state) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/poll/:pollId', (req, res) => {
  try {
    const pollId = req.params.pollId;
    const name = String(req.body?.name || '').trim().slice(0, NAME_MAX);
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    const state = readState();
    const idx = state.polls.findIndex((p) => p.id === pollId);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'poll not found' });
    if (normName(name) !== normName(state.polls[idx].createdBy)) {
      return res.status(403).json({ ok: false, error: 'only the creator can delete this poll' });
    }
    state.polls.splice(idx, 1);
    writeState(state);
    res.json({ ok: true, state: withAllTallies(state) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/poll/:pollId/option', (req, res) => {
  try {
    const pollId = req.params.pollId;
    const text = String(req.body?.text || '').trim().slice(0, TEXT_MAX);
    const name = String(req.body?.name || '').trim().slice(0, NAME_MAX);
    if (!text || !name) return res.status(400).json({ ok: false, error: 'text and name required' });
    const state = readState();
    const poll = state.polls.find((p) => p.id === pollId);
    if (!poll) return res.status(404).json({ ok: false, error: 'poll not found' });
    if (!poll.allowSuggestions && normName(name) !== normName(poll.createdBy)) {
      return res.status(403).json({ ok: false, error: 'this poll does not accept suggestions' });
    }
    if (poll.options.length >= MAX_OPTIONS_PER_POLL) return res.status(400).json({ ok: false, error: 'option limit reached' });
    const dupe = poll.options.find((o) => o.text.trim().toLowerCase() === text.toLowerCase());
    if (dupe) return res.json({ ok: true, duplicate: true, optionId: dupe.id, state: withAllTallies(state) });
    const option = { id: makeId(text, 'opt'), text, createdBy: name, createdAt: new Date().toISOString() };
    poll.options.push(option);
    writeState(state);
    res.json({ ok: true, optionId: option.id, state: withAllTallies(state) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/poll/:pollId/vote', (req, res) => {
  try {
    const pollId = req.params.pollId;
    const name = String(req.body?.name || '').trim().slice(0, NAME_MAX);
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    const state = readState();
    const poll = state.polls.find((p) => p.id === pollId);
    if (!poll) return res.status(404).json({ ok: false, error: 'poll not found' });
    const nn = normName(name);
    poll.votes = poll.votes.filter((v) => normName(v.name) !== nn);
    writeState(state);
    res.json({ ok: true, state: withAllTallies(state) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/poll/:pollId/vote', (req, res) => {
  try {
    const pollId = req.params.pollId;
    const optionId = String(req.body?.optionId || '').trim();
    const name = String(req.body?.name || '').trim().slice(0, NAME_MAX);
    if (!optionId || !name) return res.status(400).json({ ok: false, error: 'optionId and name required' });
    const state = readState();
    const poll = state.polls.find((p) => p.id === pollId);
    if (!poll) return res.status(404).json({ ok: false, error: 'poll not found' });
    if (!poll.options.find((o) => o.id === optionId)) return res.status(404).json({ ok: false, error: 'option not found' });
    poll.votes.push({ optionId, name, ts: new Date().toISOString() });
    writeState(state);
    res.json({ ok: true, state: withAllTallies(state) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use(express.static(DIST_DIR, { index: 'index.html', maxAge: '1h' }));
app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`aiworkshop listening on :${PORT}`);
});
