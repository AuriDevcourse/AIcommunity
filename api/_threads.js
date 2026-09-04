// Session discussion threads: one async thread per session (keyed by session
// date). Anyone with a name can post a comment or a one-level reply, upvote or
// downvote, and delete their own comments. Same storage approach as
// polls/suggestions. Upstash in prod (shares the store), local JSON file in dev.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { identityFor, ownsRecord } from './_identity.js';
import { isOrganizer } from './_roles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const threadKey = (date) => `aiworkshop:thread:${date}`;
const votesKey = (date) => `aiworkshop:thrvotes:${date}`;
const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const voteField = (id, key) => `${id}|${normName(key)}`;
const MAX_PER_THREAD = 800;
// A thread channel is either a session date (YYYY-MM-DD) or a topic id. Accept any
// safe slug so the same engine powers session discussions and the Discussions forum.
const validKey = (k) => /^[A-Za-z0-9:_-]{1,80}$/.test(String(k || ''));

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
    async list(date) { const raw = await cmd(['GET', threadKey(date)]); return raw ? JSON.parse(raw) : []; },
    async save(date, arr) { await cmd(['SET', threadKey(date), JSON.stringify(arr)]); },
    async getVotes(date) {
      const flat = (await cmd(['HGETALL', votesKey(date)])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip */ } }
      return out;
    },
    async setVote(date, field, value) { await cmd(['HSET', votesKey(date), field, JSON.stringify(value)]); },
    async delVote(date, field) { await cmd(['HDEL', votesKey(date), field]); },
    async purge(date) { await cmd(['DEL', threadKey(date)]); await cmd(['DEL', votesKey(date)]); },
  };
}

function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
  const FILE = join(DATA_DIR, 'threads-store.json');
  const load = () => {
    if (!existsSync(FILE)) return {};
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
  };
  // Normalise a date bucket: legacy buckets were a bare comments array.
  const bucket = (db, date) => {
    let b = db[date];
    if (Array.isArray(b)) b = { comments: b, votes: {} };
    if (!b) b = { comments: [], votes: {} };
    if (!b.votes) b.votes = {};
    db[date] = b;
    return b;
  };
  const save = (db) => { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(db, null, 2)); };
  return {
    async list(date) { const db = load(); return bucket(db, date).comments; },
    async save(date, arr) { const db = load(); bucket(db, date).comments = arr; save(db); },
    async getVotes(date) { const db = load(); return bucket(db, date).votes; },
    async setVote(date, field, value) { const db = load(); bucket(db, date).votes[field] = value; save(db); },
    async delVote(date, field) { const db = load(); delete bucket(db, date).votes[field]; save(db); },
    async purge(date) { const db = load(); delete db[date]; save(db); },
  };
}

const createStore = () => (KV_URL ? upstashStore() : fileStore());
const storageReady = () => Boolean(KV_URL) || !process.env.VERCEL;

// Delete a whole thread (comments + votes), used when its parent topic is removed.
export async function purgeThread(key, store = createStore()) {
  await store.purge(key);
}

// Attach up/down counts, score and voter names to each comment.
function enrich(comments, votes) {
  const byComment = {};
  for (const v of Object.entries(votes)) {
    const [field, val] = v;
    const id = field.split('|')[0];
    (byComment[id] = byComment[id] || []).push(val);
  }
  return comments.map((c) => {
    const up = [];
    const down = [];
    for (const v of byComment[c.id] || []) {
      if (v.dir === 'up') up.push(v.name);
      else if (v.dir === 'down') down.push(v.name);
    }
    return { ...c, up: up.length, down: down.length, score: up.length - down.length, voters: { up, down } };
  });
}

export async function handleThreads({ method, body, user = null, query, store = createStore() }) {
  if (method === 'GET') {
    const date = query?.key || query?.date;
    if (!validKey(date)) return { status: 400, json: { ok: false, error: 'valid channel required' } };
    const comments = await store.list(date);
    const votes = await store.getVotes(date);
    return { status: 200, json: { comments: enrich(comments, votes), configured: storageReady() } };
  }

  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'Discussion needs a Redis store. Connect Upstash and redeploy.' } };

  const action = body?.action;
  const who = identityFor(user, body);
  const date = body?.key || body?.date;
  if (!validKey(date)) return { status: 400, json: { ok: false, error: 'valid channel required' } };

  if (action === 'post') {
    const text = String(body.text || '').trim().slice(0, 1000);
    const name = who.name;
    const images = Array.isArray(body.images)
      ? body.images.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 500).slice(0, 4)
      : [];
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    if (text.length < 1 && images.length === 0) return { status: 400, json: { ok: false, error: 'empty comment' } };
    const comments = await store.list(date);

    // Replies go one level deep: a reply's parent must be a top-level comment.
    let parentId = body.parentId ? String(body.parentId) : null;
    if (parentId) {
      const parent = comments.find((c) => c.id === parentId);
      if (!parent) return { status: 404, json: { ok: false, error: 'parent not found' } };
      if (parent.parentId) parentId = parent.parentId; // flatten nested replies onto the root
    }

    const comment = { id: randomUUID().slice(0, 12), name, userId: who.userId, text, images, createdAt: new Date().toISOString(), parentId };
    comments.push(comment);
    if (comments.length > MAX_PER_THREAD) comments.splice(0, comments.length - MAX_PER_THREAD);
    await store.save(date, comments);
    return { status: 200, json: { ok: true, comment: { ...comment, up: 0, down: 0, score: 0, voters: { up: [], down: [] } } } };
  }

  if (action === 'delete') {
    const id = String(body.id || '');
    const comments = await store.list(date);
    const target = comments.find((c) => c.id === id);
    if (!target) return { status: 404, json: { ok: false, error: 'comment not found' } };
    // Ownership is checked against the VERIFIED session. Checking it against a
    // name in the body let any signed-in member delete anyone's comment (and,
    // for a top-level one, every reply under it).
    // The author may remove their own comment; the organizer may remove any.
    if (!ownsRecord(target, user) && !isOrganizer(user)) return { status: 403, json: { ok: false, error: 'not your comment' } };

    // Deleting a top-level comment also removes its replies.
    const removeIds = new Set([id, ...comments.filter((c) => c.parentId === id).map((c) => c.id)]);
    const next = comments.filter((c) => !removeIds.has(c.id));
    await store.save(date, next);
    // Clean up votes belonging to removed comments.
    const votes = await store.getVotes(date);
    for (const field of Object.keys(votes)) {
      if (removeIds.has(field.split('|')[0])) await store.delVote(date, field);
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === 'vote') {
    const name = who.name;
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    const dir = body.dir === 'up' ? 'up' : body.dir === 'down' ? 'down' : null;
    if (!dir) return { status: 400, json: { ok: false, error: 'bad direction' } };
    const id = String(body.id || '');
    const comments = await store.list(date);
    if (!comments.some((c) => c.id === id)) return { status: 404, json: { ok: false, error: 'comment not found' } };
    // Keyed on the verified caller, so nobody can vote as someone else. Votes
    // cast before this fix were keyed on the normalised name; clear that row
    // when the same person votes again, or they would count twice.
    const field = voteField(id, who.key);
    const legacyField = voteField(id, name);
    const votes = await store.getVotes(date);
    if (field !== legacyField && votes[legacyField]) await store.delVote(date, legacyField);
    if (votes[field]?.dir === dir) await store.delVote(date, field); // same arrow again undoes
    else await store.setVote(date, field, { name, userId: who.userId, dir });
    const fresh = enrich(comments, await store.getVotes(date)).find((c) => c.id === id);
    return { status: 200, json: { ok: true, comment: fresh } };
  }

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
