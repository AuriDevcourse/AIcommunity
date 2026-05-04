// Parses AI Workshop markdown notes + planning JSON into src/data.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES_DIR = process.env.AI_WORKSHOP_NOTES_DIR
  || (process.platform === 'win32'
    ? 'C:\\Users\\User\\Documents\\Obsidian Vault\\AI Workshop'
    : '/Users/aurimasbaciauskas/Documents/AuriGrownup/AI Workshop');
const SESSIONS_DIR = join(NOTES_DIR, 'Sessions');
const HUB_FILE = join(NOTES_DIR, 'AI Workshop.md');
const SCHEDULE_FILE = join(ROOT, 'data', 'schedule.json');
const BACKLOG_FILE = join(ROOT, 'data', 'backlog.json');
const OUT_FILE = join(ROOT, 'src', 'data.json');

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
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]*)`, 'i');
    const hit = raw.match(re);
    return hit ? hit[1].trim() : '';
  };
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

  return { number, date, location, attendees, demos, actions, summary };
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

const { members, hubActions } = parseHub();
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
