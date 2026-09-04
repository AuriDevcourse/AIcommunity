// Discussions forum: anyone (logged in) starts a topic; each topic's conversation
// lives in the threads engine keyed by the topic id (api/_threads.js). This module
// only manages the list of topics. Same storage approach as polls/suggestions
// Upstash in prod (shares the store), local JSON file in dev.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { identityFor, ownsRecord } from './_identity.js';
import { isOrganizer } from './_roles.js';
import { purgeThread } from './_threads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const LIST_KEY = 'aiworkshop:topics';

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
  };
}

function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
  const FILE = join(DATA_DIR, 'topics-store.json');
  const load = () => {
    if (!existsSync(FILE)) return [];
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
  };
  const save = (arr) => { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(arr, null, 2)); };
  return {
    async list() { return load(); },
    async save(arr) { save(arr); },
  };
}

const createStore = () => (KV_URL ? upstashStore() : fileStore());
const storageReady = () => Boolean(KV_URL) || !process.env.VERCEL;

export async function handleTopics({ method, body, user = null, store = createStore() }) {
  if (method === 'GET') {
    const topics = await store.list();
    topics.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); // newest first
    return { status: 200, json: { topics, configured: storageReady() } };
  }

  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'Discussions need a Redis store. Connect Upstash and redeploy.' } };

  const action = body?.action;
  const who = identityFor(user, body);

  if (action === 'create') {
    const title = String(body.title || '').trim().slice(0, 140);
    const name = who.name;
    if (!name) return { status: 400, json: { ok: false, error: 'name required' } };
    if (title.length < 3) return { status: 400, json: { ok: false, error: 'title too short' } };
    const topics = await store.list();
    const topic = { id: randomUUID().slice(0, 12), title, createdBy: name, userId: who.userId, createdAt: new Date().toISOString() };
    topics.push(topic);
    await store.save(topics);
    return { status: 200, json: { ok: true, topic } };
  }

  if (action === 'delete') {
    const id = String(body.id || '');
    const topics = await store.list();
    const target = topics.find((t) => t.id === id);
    if (!target) return { status: 404, json: { ok: false, error: 'topic not found' } };
    // Verified session, not the body. This delete cascades into purgeThread(),
    // so trusting body.name let any signed-in member wipe someone else's topic
    // along with every comment and vote under it.
    // The author may remove their own topic; the organizer may remove any.
    if (!ownsRecord(target, user, 'createdBy') && !isOrganizer(user)) return { status: 403, json: { ok: false, error: 'not your topic' } };
    await store.save(topics.filter((t) => t.id !== id));
    await purgeThread(id).catch(() => {}); // cascade: drop the topic's thread + votes
    return { status: 200, json: { ok: true } };
  }

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
