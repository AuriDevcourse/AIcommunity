// Per-session runtime overrides, keyed by session date: { name, order }.
//   name  → display label (Obsidian stays the source for rich content)
//   order → custom photo ordering (array of URLs); the FIRST one is the featured
//           cover. Unknown/new photos fall in after the ordered ones.
// Same storage approach as polls/topics. Upstash in prod (shares the store),
// local JSON file in dev.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEY = 'aiworkshop:sessionnames';
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

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
    async get() { const raw = await cmd(['GET', KEY]); return raw ? JSON.parse(raw) : {}; },
    async save(map) { await cmd(['SET', KEY, JSON.stringify(map)]); },
  };
}

function fileStore() {
  const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
  const FILE = join(DATA_DIR, 'session-names-store.json');
  return {
    async get() {
      if (!existsSync(FILE)) return {};
      try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
    },
    async save(map) {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(FILE, JSON.stringify(map, null, 2));
    },
  };
}

const createStore = () => (KV_URL ? upstashStore() : fileStore());
const storageReady = () => Boolean(KV_URL) || !process.env.VERCEL;

// GET: `user` is the verified reader (or { open: true } when auth is unconfigured).
// Session display names are public (the recap page shows them), but `cover` and
// `order` are Blob photo URLs, i.e. the members-only archive by another route.
// A signed-out caller gets names only.
export async function handleSessionMeta({ method, body, user = null, store = createStore() }) {
  if (method === 'GET') {
    const names = await store.get();
    if (!user) {
      const publicNames = {};
      for (const [date, entry] of Object.entries(names || {})) {
        const name = typeof entry === 'string' ? entry : entry?.name;
        if (name) publicNames[date] = { name };
      }
      return { status: 200, json: { names: publicNames, configured: storageReady(), photosHidden: true } };
    }
    return { status: 200, json: { names, configured: storageReady() } };
  }
  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'Editing needs a Redis store. Connect Upstash and redeploy.' } };

  const date = String(body?.date || '');
  if (!isDate(date)) return { status: 400, json: { ok: false, error: 'valid session date required' } };

  const map = await store.get();
  // Migrate any legacy string entries ("name") to the object shape.
  const entry = typeof map[date] === 'string' ? { name: map[date] } : { ...(map[date] || {}) };

  // Only the keys present in the body are touched; an empty value clears that field.
  if ('name' in body) {
    const v = String(body.name || '').trim().slice(0, 80);
    if (v) entry.name = v; else delete entry.name;
  }
  if ('order' in body) {
    const arr = Array.isArray(body.order)
      ? body.order.filter((u) => typeof u === 'string' && u.length <= 500).slice(0, 500)
      : [];
    if (arr.length) entry.order = arr; else delete entry.order;
  }

  if (Object.keys(entry).length) map[date] = entry; else delete map[date];
  await store.save(map);
  return { status: 200, json: { ok: true, date, meta: entry } };
}
