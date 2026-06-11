// In-dashboard RSVPs, keyed by session date:
//   { [date]: { [userId]: { name, avatar, status, ts } } }
//   status ∈ 'going' | 'maybe'   (anything else removes the RSVP)
// Identity (userId / name / avatar) is ALWAYS derived from the verified Supabase
// user server-side — never from the request body (see api/_guard.js requireUser).
// Same storage approach as session-meta/polls: Upstash in prod, a local JSON file
// in dev.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEY = 'aiworkshop:rsvp';
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
  const FILE = join(DATA_DIR, 'rsvp-store.json');
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

// Mirror the client's identity helpers (src/lib/auth.jsx) so the same person
// renders identically whether the name comes from RSVP or the calendar.
function nameOf(user) {
  const m = user?.user_metadata || {};
  return String(m.full_name || m.name || (user?.email ? user.email.split('@')[0] : '') || 'Member').slice(0, 48);
}
function avatarOf(user) {
  const m = user?.user_metadata || {};
  return String(m.avatar_url || m.picture || '').slice(0, 500);
}

// Collapse the stored map for a date into public going/maybe lists (no user IDs
// leak out). Sorted by RSVP time so the order is stable.
function listFor(map, date) {
  const entries = Object.values(map[date] || {})
    .filter((e) => e && (e.status === 'going' || e.status === 'maybe'))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const going = entries.filter((e) => e.status === 'going').map((e) => ({ name: e.name, avatar: e.avatar || '' }));
  const maybe = entries.filter((e) => e.status === 'maybe').map((e) => ({ name: e.name, avatar: e.avatar || '' }));
  return { going, maybe, counts: { going: going.length, maybe: maybe.length } };
}

export async function handleRsvpGet({ query, store = createStore() }) {
  const date = String(query?.date || '');
  if (!isDate(date)) return { status: 400, json: { ok: false, error: 'valid session date required' } };
  if (!storageReady()) return { status: 200, json: { configured: false, going: [], maybe: [], counts: { going: 0, maybe: 0 } } };
  const map = await store.get();
  return { status: 200, json: { configured: true, date, ...listFor(map, date) } };
}

export async function handleRsvpPost({ body, user, store = createStore() }) {
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'RSVPs need a Redis store. Connect Upstash and redeploy.' } };
  const date = String(body?.date || '');
  if (!isDate(date)) return { status: 400, json: { ok: false, error: 'valid session date required' } };
  const raw = body?.status;
  const status = raw === 'going' || raw === 'maybe' ? raw : null; // anything else clears

  const map = await store.get();
  const forDate = { ...(map[date] || {}) };
  if (status) {
    forDate[user.id] = { name: nameOf(user), avatar: avatarOf(user), status, ts: Date.now() };
  } else {
    delete forDate[user.id];
  }
  if (Object.keys(forDate).length) map[date] = forDate; else delete map[date];
  await store.save(map);
  return { status: 200, json: { ok: true, date, mine: status, ...listFor(map, date) } };
}
