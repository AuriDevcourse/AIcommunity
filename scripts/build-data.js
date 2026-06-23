// Parses AI Workshop markdown notes + planning JSON into src/data.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Session notes now live IN THIS REPO (content/sessions) — the transcribe pipeline
// writes them here directly, so Obsidian is NOT required to build or deploy.
// Override with AI_WORKSHOP_SESSIONS_DIR if you ever keep them elsewhere.
const SESSIONS_DIR = process.env.AI_WORKSHOP_SESSIONS_DIR || join(ROOT, 'content', 'sessions');

// The member/hub doc stays OPTIONAL in the Obsidian vault (rarely edited). If it's
// not present (e.g. a Vercel build, or no vault), members fall back to the committed
// src/data.json snapshot below — so the dashboard never loses its member list.
const VAULT_DIR = process.platform === 'win32'
  ? 'C:\\Users\\User\\Documents\\Obsidian Vault\\AI Workshop'
  : '/Users/aurimasbaciauskas/Documents/AuriGrownup/AI Workshop';
const HUB_FILE = process.env.AI_WORKSHOP_HUB_FILE || join(VAULT_DIR, 'AI Workshop.md');
const SCHEDULE_FILE = join(ROOT, 'data', 'schedule.json');
const BACKLOG_FILE = join(ROOT, 'data', 'backlog.json');
const OUT_FILE = join(ROOT, 'src', 'data.json');
const SESSION_PHOTOS_DIR = join(ROOT, 'public', 'sessions');

const PHOTO_EXT = /\.(jpe?g|png|webp|gif)$/i;
const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/;

function listSessionPhotosForDate(dateIso) {
  if (!dateIso) return [];
  const dir = join(SESSION_PHOTOS_DIR, dateIso);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => PHOTO_EXT.test(f))
    .sort()
    .map((f) => `/sessions/${dateIso}/${f}`);
}

function listAllPhotoDates() {
  if (!existsSync(SESSION_PHOTOS_DIR)) return [];
  return readdirSync(SESSION_PHOTOS_DIR).filter((f) => DATE_FOLDER.test(f));
}

// On Vercel, don't regenerate: ship the committed src/data.json that was built and
// reviewed locally (the hub/members + any vault-sourced bits live on the local box).
// This keeps deploys deterministic and avoids a partial rebuild dropping data.
if (process.env.VERCEL && existsSync(OUT_FILE)) {
  console.log('build-data: on Vercel — using committed src/data.json snapshot');
  process.exit(0);
}

if (!existsSync(SESSIONS_DIR)) {
  if (existsSync(OUT_FILE)) {
    console.log(`build-data: notes dir not found (${SESSIONS_DIR}) — keeping existing src/data.json snapshot`);
    process.exit(0);
  }
  console.error(`build-data: notes dir not found (${SESSIONS_DIR}) and no existing src/data.json snapshot to fall back on`);
  process.exit(1);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

function parseSessionFile(filename) {
  const m = filename.match(/^#(\d+)\s+SESSION\s+(\d{4}-\d{2}-\d{2})\.md$/);
  if (!m) return null;
  const number = parseInt(m[1], 10);
  const date = m[2];
  const raw = read(join(SESSIONS_DIR, filename));

  const get = (label) => {
    // [^\S\n]* = inline whitespace only (NOT newlines), so an empty field like
    // "**Attendees:**\n\n> note" returns '' instead of swallowing the next line.
    const re = new RegExp(`\\*\\*${label}:\\*\\*[^\\S\\n]*([^\\n]*)`, 'i');
    const hit = raw.match(re);
    return hit ? hit[1].trim() : '';
  };
  const title = get('Title'); // optional human label ("what we talked about"); falls back to "Session #N" in the UI
  const location = get('Location');
  const attendees = (get('Attendees') || get('Attendees \\(in-person\\)') || '')
    .split(/,\s*/).map((s) => s.trim()).filter(Boolean);

  // Demos: find "### Name — Topic" blocks under "## Demos"
  const demos = [];
  const demoSection = raw.split(/^## Demos/m)[1]?.split(/^## /m)[0] || '';
  const demoBlocks = demoSection.split(/^### /m).slice(1);
  for (const block of demoBlocks) {
    const headLine = block.split('\n')[0].trim();
    if (!headLine || headLine === 'TBD') continue;
    const [presenter, ...rest] = headLine.split(/\s+[—–-]\s+/);
    demos.push({ presenter: presenter.trim(), topic: rest.join(' — ').trim() });
  }

  // Action items
  const actionRe = /^## Action Items[\s\S]*?(?=^## |\Z)/m;
  const actionBlock = raw.match(actionRe)?.[0] || '';
  const actions = [...actionBlock.matchAll(/^- \[( |x)\]\s+(.+)$/gm)].map((mm) => ({
    done: mm[1] === 'x',
    text: mm[2].trim(),
    sessionNumber: number,
    sessionDate: date,
  }));

  // Top-of-file summary
  const aboutMatch = raw.match(/^## About This Session\s*\n+([^\n][^\n]*(?:\n[^\n#].*)*)/m);
  const summary = aboutMatch ? aboutMatch[1].trim() : '';

  // Topics: "### Title" blocks under "## Topics", each followed by a paragraph.
  // The public-safe "what we talked about" breakdown.
  const topicsSection = raw.split(/^## Topics\s*$/m)[1]?.split(/^## /m)[0] || '';
  const topics = topicsSection.split(/^### /m).slice(1).map((block) => {
    const lines = block.split('\n');
    return { title: lines[0].trim(), summary: lines.slice(1).join('\n').trim() };
  }).filter((t) => t.title);

  // Tools & products discussed: "- **Name** — note" bullets (the AI ideas of the
  // session). Drives the recap "Tools discussed" list + the auto LinkedIn draft.
  const toolsSection = raw.split(/^## Tools[^\n]*$/m)[1]?.split(/^## /m)[0] || '';
  const tools = [...toolsSection.matchAll(/^-\s+\*\*(.+?)\*\*\s*(?:[—–-]\s*(.+))?$/gm)]
    .map((mm) => {
      // The name may be a markdown link "[Name](https://site)" → split out the URL
      // so the recap can render it as a clickable chip. Plain names get no link.
      let name = mm[1].trim();
      let url = '';
      const link = name.match(/^\[(.+?)\]\((https?:\/\/[^)]+)\)$/);
      if (link) { name = link[1].trim(); url = link[2].trim(); }
      return { name, note: (mm[2] || '').trim(), url };
    })
    .filter((t) => t.name);

  const photos = listSessionPhotosForDate(date);
  return { number, date, title, location, attendees, demos, actions, summary, topics, tools, photos };
}

function parseHub() {
  const raw = read(HUB_FILE);
  // Members table
  const tableMatch = raw.match(/\| Name \| Status \|\n\|[-\s|]+\|\n([\s\S]*?)\n\n/);
  const members = [];
  if (tableMatch) {
    for (const line of tableMatch[1].split('\n')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) members.push({ name: cells[0], status: cells[1] });
    }
  }
  // Hub action items
  const actionBlock = raw.match(/^## Action Items[\s\S]*?(?=^## |\Z)/m)?.[0] || '';
  const hubActions = [...actionBlock.matchAll(/^- \[( |x)\]\s+(.+)$/gm)].map((m) => ({
    done: m[1] === 'x',
    text: m[2].trim(),
    source: 'hub',
  }));
  return { members, hubActions };
}

const sessions = readdirSync(SESSIONS_DIR)
  .map(parseSessionFile)
  .filter(Boolean)
  .sort((a, b) => a.number - b.number);

const documentedDates = new Set(sessions.map((s) => s.date));
for (const dateIso of listAllPhotoDates()) {
  if (documentedDates.has(dateIso)) continue;
  const photos = listSessionPhotosForDate(dateIso);
  if (photos.length === 0) continue;
  sessions.push({
    number: null,
    date: dateIso,
    title: '',
    location: '',
    attendees: [],
    demos: [],
    actions: [],
    summary: '',
    tools: [],
    photos,
  });
}
sessions.sort((a, b) => a.date.localeCompare(b.date));

let { members, hubActions } = parseHub();
// If the (optional) hub doc wasn't found, keep the members from the last committed
// snapshot so a vault-less build (Vercel) doesn't drop the member list.
if (!members.length && existsSync(OUT_FILE)) {
  members = readJson(OUT_FILE)?.members || [];
}
const schedule = readJson(SCHEDULE_FILE) || { upcoming: [], gaps: [] };
const backlog = readJson(BACKLOG_FILE) || [];

const allActions = [
  ...hubActions,
  ...sessions.flatMap((s) => s.actions.map((a) => ({ ...a, source: `#${s.number}` }))),
].filter((a) => !a.done && a.text.toLowerCase() !== 'tbd' && a.text.length > 1);

const out = {
  generatedAt: new Date().toISOString(),
  sessions,
  members,
  schedule,
  backlog,
  openActions: allActions,
};

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`build-data: ${sessions.length} sessions, ${members.length} members, ${schedule.upcoming.length} upcoming, ${allActions.length} open actions → src/data.json`);
