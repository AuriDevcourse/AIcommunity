// Shared polls logic, used by the Vercel serverless function (api/polls.js),
// the Vite dev middleware (vite.config.js), and the self-host server (server.js).
//
// Storage: Upstash Redis if KV_REST_API_URL is present (production on Vercel),
// otherwise a local JSON file (dev + self-host). Same logical operations either way.
//
// Vote model: votes for a poll live in a Redis hash keyed by the voter's
// verified Supabase user id → one field per person, so simultaneous voters never
// clobber each other, and re-voting overwrites (one vote per member). The key is
// the session's user id, never a name from the request body: a name can be
// changed in the profile editor, and keying on it let anyone overwrite anyone.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { identityFor, normName as normIdentity } from './_identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIST_KEY = 'aiworkshop:polls';
const votesKey = (id) => `aiworkshop:votes:${id}`;

const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const slug = (s) =>
  String(s || 'poll').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'poll';

// Accept either the Vercel KV names or the raw Upstash names, whichever the
// integration injects.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// ---------------------------------------------------------------- Upstash store
function upstashStore() {
  const url = KV_URL;
  const token = KV_TOKEN;
  const cmd = async (command) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!r.ok) throw new Error(`upstash ${r.status}: ${await r.text()}`);
    return (await r.json()).result;
  };
  return {
    async listPolls() {
      const raw = await cmd(['GET', LIST_KEY]);
      return raw ? JSON.parse(raw) : [];
    },
    async savePolls(arr) {
      await cmd(['SET', LIST_KEY, JSON.stringify(arr)]);
    },
    async getVotes(pollId) {
      const flat = (await cmd(['HGETALL', votesKey(pollId)])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) {
        try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip */ }
      }
      return out;
    },
    async putVote(pollId, key, value) {
      await cmd(['HSET', votesKey(pollId), key, JSON.stringify(value)]);
    },
    async delVote(pollId, key) {
      await cmd(['HDEL', votesKey(pollId), key]);
    },
    async deletePoll(pollId) {
      const polls = (await this.listPolls()).filter((p) => p.id !== pollId);
      await this.savePolls(polls);
      await cmd(['DEL', votesKey(pollId)]);
    },
  };
}

// ------------------------------------------------------------- local-file store
function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
  const FILE = join(DATA_DIR, 'polls-store.json');
  const load = () => {
    if (!existsSync(FILE)) return { polls: [], votes: {} };
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return { polls: [], votes: {} }; }
  };
  const save = (db) => {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(db, null, 2));
  };
  return {
    async listPolls() { return load().polls; },
    async savePolls(arr) { const db = load(); db.polls = arr; save(db); },
    async getVotes(pollId) { return load().votes[pollId] || {}; },
    async putVote(pollId, key, value) {
      const db = load();
      db.votes[pollId] = db.votes[pollId] || {};
      db.votes[pollId][key] = value;
      save(db);
    },
    async delVote(pollId, key) {
      const db = load();
      if (db.votes[pollId]) { delete db.votes[pollId][key]; save(db); }
    },
    async deletePoll(pollId) {
      const db = load();
      db.polls = db.polls.filter((p) => p.id !== pollId);
      delete db.votes[pollId];
      save(db);
    },
  };
}

export function createStore() {
  return KV_URL ? upstashStore() : fileStore();
}

// --------------------------------------------------------------------- results
function withResults(poll, votes) {
  const counts = {};
  const voters = {};
  for (const opt of poll.options) { counts[opt.id] = 0; voters[opt.id] = []; }
  let totalVoters = 0;
  for (const v of Object.values(votes)) {
    totalVoters += 1;
    for (const oid of v.optionIds || []) {
      if (counts[oid] === undefined) continue;
      counts[oid] += 1;
      voters[oid].push(v.name);
    }
  }
  return { ...poll, results: counts, voters, totalVoters };
}

// Storage is ready if Upstash is configured, or we're somewhere with a writable
// FS (local dev / self-host). On Vercel without KV, writes would hit a read-only
// FS, so we refuse them with a clear message instead of crashing (EROFS).
const storageReady = () => Boolean(KV_URL) || !process.env.VERCEL;

// ---------------------------------------------------------------- main handler
export async function handlePolls({ method, body, user = null, store = createStore() }) {
  if (method === 'GET') {
    const polls = await store.listPolls();
    const withVotes = await Promise.all(
      polls.map(async (p) => withResults(p, await store.getVotes(p.id))),
    );
    withVotes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { status: 200, json: { polls: withVotes, configured: storageReady() } };
  }

  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };

  if (!storageReady()) {
    return { status: 200, json: { ok: false, configured: false, error: 'Polls need a Redis store. Connect Upstash and redeploy.' } };
  }

  const action = body?.action;
  const who = identityFor(user, body);

  if (action === 'create') {
    const question = String(body.question || '').trim().slice(0, 200);
    const options = (body.options || [])
      .map((o) => String(o || '').trim().slice(0, 100))
      .filter(Boolean);
    if (!question) return { status: 400, json: { ok: false, error: 'question required' } };
    if (options.length < 2) return { status: 400, json: { ok: false, error: 'need at least 2 options' } };
    // Duplicate labels produce a poll nobody can answer sensibly: two identical
    // rows with separate tallies. Compared case- and space-insensitively, since
    // "Ollama" and "ollama " are the same answer to a human.
    const seen = new Map();
    for (const label of options) {
      const key = label.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) {
        return { status: 400, json: { ok: false, error: `Duplicate option: "${seen.get(key)}" and "${label}" are the same.` } };
      }
      seen.set(key, label);
    }
    const id = `${slug(question)}-${randomUUID().slice(0, 4)}`;
    const poll = {
      id,
      question,
      multi: Boolean(body.multi),
      options: options.slice(0, 12).map((label, i) => ({ id: `o${i + 1}`, label })),
      closed: false,
      createdBy: who.name || 'someone',
      userId: who.userId,
      createdAt: new Date().toISOString(),
    };
    const polls = await store.listPolls();
    polls.push(poll);
    await store.savePolls(polls);
    return { status: 200, json: { ok: true, poll } };
  }

  if (action === 'vote') {
    const name = who.name;
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    const polls = await store.listPolls();
    const poll = polls.find((p) => p.id === body.pollId);
    if (!poll) return { status: 404, json: { ok: false, error: 'poll not found' } };
    if (poll.closed) return { status: 409, json: { ok: false, error: 'poll closed' } };
    const valid = new Set(poll.options.map((o) => o.id));
    let optionIds = [...new Set((body.optionIds || []).filter((o) => valid.has(o)))];
    if (optionIds.length === 0) return { status: 400, json: { ok: false, error: 'pick at least one option' } };
    if (!poll.multi) optionIds = optionIds.slice(0, 1);
    // Keyed on the verified caller so nobody can cast or overwrite another
    // person's vote. Votes cast before this fix were keyed on the normalised
    // name; drop that row when the same person votes again, or they would be
    // counted twice.
    await store.putVote(poll.id, who.key, { name, userId: who.userId, optionIds });
    const legacyKey = normIdentity(name);
    if (who.key !== legacyKey) await store.delVote(poll.id, legacyKey);
    return { status: 200, json: { ok: true, poll: withResults(poll, await store.getVotes(poll.id)) } };
  }

  // close + delete are intentionally NOT exposed via the API, manage polls
  // (close/lock, delete) directly in the Upstash database. Set a poll's
  // "closed": true there and the UI will disable voting on it.

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
