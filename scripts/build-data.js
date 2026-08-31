// Parses AI Workshop markdown notes + planning JSON into src/data.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Session notes now live IN THIS REPO (content/sessions), the transcribe pipeline
// writes them here directly, so Obsidian is NOT required to build or deploy.
// Override with AI_WORKSHOP_SESSIONS_DIR if you ever keep them elsewhere.
const SESSIONS_DIR = process.env.AI_WORKSHOP_SESSIONS_DIR || join(ROOT, 'content', 'sessions');

// The member/hub doc stays OPTIONAL in the Obsidian vault (rarely edited). If it's
// not present (e.g. a Vercel build, or no vault), members fall back to the committed
// src/data.json snapshot below, so the dashboard never loses its member list.
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
// Syncing clients (iCloud/Dropbox) drop byte-identical "IMG_4549 2.jpg" copies
// next to the originals. They are gitignored, so they never deploy, but this
// script reads the filesystem, not the index, so without this filter it writes
// them into data.json and production renders them as broken images. 28 of 77
// photo references were phantoms before this.
//
// Matching on " <n>.<ext>" alone is too greedy: a real file called
// "Screenshot 2025-09-19 110140.png" ends that way. A sync duplicate is only a
// duplicate if the original it was copied from is sitting next to it, so test
// for that too.
const SYNC_SUFFIX = /^(.*) ([2-9])(\.[a-z0-9]+)$/i;

function isSyncDuplicate(file, siblings) {
  const m = file.match(SYNC_SUFFIX);
  return Boolean(m) && siblings.has(m[1] + m[3]);
}

// A photo that exists on this laptop but is not tracked by git will not be in
// the deployed bundle, so referencing it from data.json produces a broken image
// in production and a working one in local dev, the worst kind of bug to spot.
// Skip those and name them, so `git add` is the obvious next step.
const untrackedRefs = [];
let trackedPublic = null;
function isTracked(publicRelPath) {
  if (trackedPublic === null) {
    try {
      const out = execSync('git ls-files public/', { cwd: ROOT, maxBuffer: 1e8 }).toString();
      trackedPublic = new Set(out.split('\n').filter(Boolean));
    } catch {
      trackedPublic = false; // no git available (some CI checkouts), don't filter
    }
  }
  if (trackedPublic === false) return true;
  return trackedPublic.has(`public${publicRelPath}`);
}

function listSessionPhotosForDate(dateIso) {
  if (!dateIso) return [];
  const dir = join(SESSION_PHOTOS_DIR, dateIso);
  if (!existsSync(dir)) return [];
  const all = readdirSync(dir);
  const siblings = new Set(all);
  return all
    .filter((f) => PHOTO_EXT.test(f) && !isSyncDuplicate(f, siblings))
    .sort()
    .map((f) => `/sessions/${dateIso}/${f}`)
    .filter((rel) => {
      if (isTracked(rel)) return true;
      untrackedRefs.push(rel);
      return false;
    });
}

function listAllPhotoDates() {
  if (!existsSync(SESSION_PHOTOS_DIR)) return [];
  return readdirSync(SESSION_PHOTOS_DIR).filter((f) => DATE_FOLDER.test(f));
}

// On Vercel, don't regenerate: ship the committed src/data.json that was built and
// reviewed locally (the hub/members + any vault-sourced bits live on the local box).
// This keeps deploys deterministic and avoids a partial rebuild dropping data.
if (process.env.VERCEL && existsSync(OUT_FILE)) {
  console.log('build-data: on Vercel, using committed src/data.json snapshot');
  process.exit(0);
}

if (!existsSync(SESSIONS_DIR)) {
  if (existsSync(OUT_FILE)) {
    console.log(`build-data: notes dir not found (${SESSIONS_DIR}), keeping existing src/data.json snapshot`);
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

  // Demos: find "### Name. Topic" blocks under "## Demos"
  const demos = [];
  const demoSection = raw.split(/^## Demos/m)[1]?.split(/^## /m)[0] || '';
  const demoBlocks = demoSection.split(/^### /m).slice(1);
  for (const block of demoBlocks) {
    const headLine = block.split('\n')[0].trim();
    if (!headLine || headLine === 'TBD') continue;
    const [presenter, ...rest] = headLine.split(/\s+[—–-]\s+/);
    demos.push({ presenter: presenter.trim(), topic: rest.join(', ').trim() });
  }

  // Action items
  // `\Z` is not a JavaScript anchor, it matches a literal "Z", so this block
  // was being cut at the first capital Z in the text (a name like "Zoe" ate the
  // rest of the list). `(?![\s\S])` is a real end-of-input assertion; plain `$`
  // will not do, because under /m it matches at every line ending.
  const actionRe = /^## Action Items[\s\S]*?(?=^## |(?![\s\S]))/m;
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

  // Tools & products discussed: "- **Name**, note" bullets (the AI ideas of the
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
  // Terminating only on a blank line assumed content always follows the table.
  // If the table is the last thing in the hub file, the match fails and members
  // silently comes back empty, the same shape of bug as the `\Z` one above.
  const tableMatch = raw.match(/\| Name \| Status \|\n\|[-\s|]+\|\n([\s\S]*?)(?:\n\n|(?![\s\S]))/);
  const members = [];
  if (tableMatch) {
    for (const line of tableMatch[1].split('\n')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) members.push({ name: cells[0], status: cells[1] });
    }
  }
  // Hub action items
  const actionBlock = raw.match(/^## Action Items[\s\S]*?(?=^## |(?![\s\S]))/m)?.[0] || '';
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
if (untrackedRefs.length) {
  console.warn(`build-data: WARNING, ${untrackedRefs.length} photo(s) exist locally but are not tracked by git, so they were left out (they would 404 in production):`);
  for (const r of untrackedRefs) console.warn(`build-data:   git add "public${r}"`);
}
