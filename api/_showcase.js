// Community project showcase: the cards on the public Projects tab. Anyone can
// read them; any signed-in member can add one. Same storage approach as the
// member board (Upstash in prod, a local JSON file in dev), but keyed by a
// generated project id and carrying the VERIFIED author id, so only the author
// (or the organizer) can remove a card. No user id ever leaves the server.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityFor } from './_identity.js';
import { isOrganizer, ORGANIZER_ONLY } from './_roles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEY = 'aisundays:showcase'; // { [projectId]: card }

const STATUSES = ['live', 'beta', 'wip'];
const CAP = { name: 80, tagline: 120, desc: 400, by: 60, tag: 24, url: 500 };
const MAX_TAGS = 3;
const MAX_PER_MEMBER = 12;

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
  const FILE = join(DATA_DIR, 'showcase-store.json');
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

const text = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Only http(s) links, so a card can never carry a javascript: or data: URL.
function cleanUrl(raw) {
  const s = String(raw || '').trim().slice(0, CAP.url);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch { return null; }
}

function cleanTags(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return arr.map((t) => text(t, CAP.tag)).filter(Boolean).slice(0, MAX_TAGS);
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Public shape: author id stays server-side, the owner is marked with `mine`.
function publicList(map, viewer) {
  return Object.entries(map)
    .map(([id, c]) => ({
      id,
      name: c.name, tagline: c.tagline || '', desc: c.desc || '',
      url: c.url, thumb: c.thumb || '', status: c.status || 'live',
      tags: c.tags || [], by: c.by || '', createdAt: c.createdAt || '',
      mine: Boolean(viewer?.id && viewer.id === c.authorId),
    }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function handleShowcase({ method, body, user = null, store = createStore() }) {
  if (method === 'GET') {
    if (!storageReady()) return { status: 200, json: { configured: false, projects: [] } };
    const map = await store.get();
    return { status: 200, json: { configured: true, projects: publicList(map, user) } };
  }
  if (method !== 'POST') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  if (!storageReady()) return { status: 200, json: { ok: false, configured: false, error: 'The project showcase needs a Redis store. Connect Upstash and redeploy.' } };
  if (!user?.id) return { status: 401, json: { ok: false, error: 'Please sign in to add a project.' } };

  const action = body?.action;
  const map = await store.get();
  const who = identityFor(user, body);

  if (action === 'add') {
    const name = text(body.name, CAP.name);
    const url = cleanUrl(body.url);
    const thumb = cleanUrl(body.thumb);
    if (!name) return { status: 422, json: { ok: false, error: 'Give your project a name.' } };
    if (url === null || !url) return { status: 422, json: { ok: false, error: 'Add a link that starts with http:// or https://.' } };
    if (thumb === null) return { status: 422, json: { ok: false, error: 'That picture URL is not valid.' } };
    const status = STATUSES.includes(body.status) ? body.status : 'live';
    const mineCount = Object.values(map).filter((c) => c.authorId === user.id).length;
    if (mineCount >= MAX_PER_MEMBER) return { status: 422, json: { ok: false, error: `You can add up to ${MAX_PER_MEMBER} projects.` } };
    const id = genId();
    map[id] = {
      authorId: user.id,
      name,
      tagline: text(body.tagline, CAP.tagline),
      desc: text(body.desc, CAP.desc),
      url, thumb, status,
      tags: cleanTags(body.tags),
      by: text(body.by, CAP.by) || who.name || 'A member',
      createdAt: new Date().toISOString(),
    };
    await store.save(map);
    return { status: 200, json: { ok: true, id, projects: publicList(map, user) } };
  }

  if (action === 'delete') {
    // The target is named by its public id; a member can only delete their own
    // card (organizer: any).
    const id = String(body.id || '');
    const card = map[id];
    if (!card) return { status: 404, json: { ok: false, error: 'project not found' } };
    if (card.authorId !== user.id && !isOrganizer(user)) return ORGANIZER_ONLY;
    delete map[id];
    await store.save(map);
    return { status: 200, json: { ok: true, projects: publicList(map, user) } };
  }

  return { status: 400, json: { ok: false, error: 'unknown action' } };
}
