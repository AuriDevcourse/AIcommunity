// Community suggestions board: anyone (with a name) suggests what to build next,
// everyone sees it, people upvote/downvote. One vote per name per suggestion
// (click the same arrow again to undo). Same storage approach as polls — Upstash
// in prod (shares the store), local JSON file in dev.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const LIST_KEY = 'aiworkshop:suggestions';
const votesKey = (id) => `aiworkshop:sugvotes:${id}`;
const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function upstashStore() {
  const cmd = async (command) => {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!r.ok) throw new Error(`upstash ${r.status}: ${await r.text()}`);
    return (await r.json()).result;
  };
  return {
    async list() { const raw = await cmd(['GET', LIST_KEY]); return raw ? JSON.parse(raw) : []; },
    async save(arr) { await cmd(['SET', LIST_KEY, JSON.stringify(arr)]); },
    async getVotes(id) {
      const flat = (await cmd(['HGETALL', votesKey(id)])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip */ } }
      return out;
    },
    async setVote(id, key, value) { await cmd(['HSET', votesKey(id), key, JSON.stringify(value)]); },
    async delVote(id, key) { await cmd(['HDEL', votesKey(id), key]); },
  };
}

function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
  const FILE = join(DATA_DIR, 'suggestions-store.json');
  const load = () => {
    if (!existsSync(FILE)) return { items: [], votes: {} };
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return { items: [], votes: {} }; }
  };
  const save = (db) => { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(db, null, 2)); };
  return {
    async list() { return load().items; },
    async save(arr) { const db = load(); db.items = arr; save(db); },
    async getVotes(id) { return load().votes[id] || {}; },
    async setVote(id, key, value) { const db = load(); db.votes[id] = db.votes[id] || {}; db.votes[id][key] = value; save(db); },
    async delVote(id, key) { const db = load(); if (db.votes[id]) delete db.votes[id][key]; save(db); },
  };
}

const createStore = () => (KV_URL ? upstashStore() : fileStore());
const storageReady = () => Boolean(KV_URL) || !process.env.VERCEL;

function withScore(s, votes) {
  const upNames = [];
  const downNames = [];
  for (const v of Object.values(votes)) {
    if (v.dir === 'up') upNames.push(v.name);
    else if (v.dir === 'down') downNames.push(v.name);
  }
  return { ...s, up: upNames.length, down: downNames.length, score: upNames.length - downNames.length, voters: { up: upNames, down: downNames } };
}

export async function handleSuggestions({ method, body, store = createStore() }) {
  if (method === 'GET') {
    const items = await store.list();
    const out = await Promise.all(items.map(async (s) => withScore(s, await store.getVotes(s.id))));
    out.sort((a, b) => b.score - a.score || (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { status: 200, json: { suggestions: out, configured: storageReady() } };
  }

  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'Suggestions need a Redis store. Connect Upstash and redeploy.' } };

  const action = body?.action;

  if (action === 'create') {
    const text = String(body.text || '').trim().slice(0, 280);
    const name = String(body.name || '').trim().slice(0, 48);
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    if (text.length < 3) return { status: 400, json: { ok: false, error: 'suggestion too short' } };
    const items = await store.list();
    const s = { id: randomUUID().slice(0, 8), text, createdBy: name, createdAt: new Date().toISOString() };
    items.push(s);
    await store.save(items);
    return { status: 200, json: { ok: true, suggestion: withScore(s, {}) } };
  }

  if (action === 'vote') {
    const name = String(body.name || '').trim().slice(0, 48);
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    const dir = body.dir === 'up' ? 'up' : body.dir === 'down' ? 'down' : null;
    if (!dir) return { status: 400, json: { ok: false, error: 'bad direction' } };
    const items = await store.list();
    const s = items.find((x) => x.id === body.id);
    if (!s) return { status: 404, json: { ok: false, error: 'suggestion not found' } };
    const key = normName(name);
    const votes = await store.getVotes(s.id);
    if (votes[key]?.dir === dir) await store.delVote(s.id, key); // clicking same arrow undoes
    else await store.setVote(s.id, key, { name, dir });
    return { status: 200, json: { ok: true, suggestion: withScore(s, await store.getVotes(s.id)) } };
  }

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
