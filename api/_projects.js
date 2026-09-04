// Member Projects board: one card per member, written by the member.
//
// The community is a portfolio accelerator: people ship things and show them.
// This is where that shows up between Sundays. A card is three lines: what I am
// building, the last thing I shipped, one link. Members opt in by writing one,
// so nobody is listed here without having said so themselves.
//
// Same storage approach as topics/polls: Upstash in prod, a local JSON file in
// dev. Keyed by the VERIFIED user id, so a member can only ever write their own
// card. Only the owner or the organizer can remove one.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityFor } from './_identity.js';
import { isOrganizer, ORGANIZER_ONLY } from './_roles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEY = 'aisundays:projects'; // { [userId]: card }

const MAX_TEXT = 160;
const MAX_LINK = 300;

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
  const FILE = join(DATA_DIR, 'projects-store.json');
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

// Only http(s) links, so a card can never carry javascript: or data: URLs.
function cleanLink(raw) {
  const s = String(raw || '').trim().slice(0, MAX_LINK);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const text = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

// Public shape: no user ids leave the server, the owner is marked with `mine`.
function listFor(map, viewer) {
  return Object.entries(map)
    .map(([userId, c]) => ({
      id: userId.slice(0, 8), // stable enough for a React key, not the real id
      name: c.name, avatar: c.avatar || '',
      building: c.building || '', shipped: c.shipped || '', link: c.link || '',
      updatedAt: c.updatedAt || '',
      mine: Boolean(viewer?.id && viewer.id === userId),
    }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function handleProjects({ method, body, user = null, store = createStore() }) {
  if (method === 'GET') {
    if (!storageReady()) return { status: 200, json: { configured: false, projects: [] } };
    const map = await store.get();
    return { status: 200, json: { configured: true, projects: listFor(map, user) } };
  }
  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'The projects board needs a Redis store. Connect Upstash and redeploy.' } };
  if (!user?.id) return { status: 401, json: { ok: false, error: 'Please sign in to do that.' } };

  const action = body?.action;
  const who = identityFor(user, body);
  const map = await store.get();

  if (action === 'save') {
    const building = text(body.building);
    const shipped = text(body.shipped);
    const link = cleanLink(body.link);
    if (link === null) return { status: 422, json: { ok: false, error: 'The link must start with http:// or https://.' } };
    if (!building && !shipped) return { status: 422, json: { ok: false, error: 'Say what you are building, or what you shipped.' } };
    map[user.id] = {
      name: who.name, avatar: who.avatar,
      building, shipped, link,
      createdAt: map[user.id]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.save(map);
    return { status: 200, json: { ok: true, projects: listFor(map, user) } };
  }

  if (action === 'delete') {
    // Your own card, or any card if you are the organizer. The target is named
    // by the public 8-char id, never by a user id from the body.
    const targetId = String(body.id || '');
    const ownerId = Object.keys(map).find((uid) => uid.slice(0, 8) === targetId);
    if (!ownerId) return { status: 404, json: { ok: false, error: 'card not found' } };
    if (ownerId !== user.id && !isOrganizer(user)) return ORGANIZER_ONLY;
    delete map[ownerId];
    await store.save(map);
    return { status: 200, json: { ok: true, projects: listFor(map, user) } };
  }

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
