// Parses AI Workshop markdown notes + planning JSON into src/data.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
// Personal vault paths are only defaults for the two machines that author the
// notes. Anywhere else (CI, Vercel, a fork) set AI_WORKSHOP_NOTES_DIR, or accept
// the committed src/data.json snapshot — see the ALLOW_STALE_DATA note below.
const NOTES_DIR = process.env.AI_WORKSHOP_NOTES_DIR
  || (process.platform === 'win32'
    ? 'C:\\Users\\User\\Documents\\Obsidian Vault\\AI Workshop'
    : '/Users/aurimasbaciauskas/Documents/AuriGrownup/AI Workshop');
const SESSIONS_DIR = join(NOTES_DIR, 'Sessions');
const HUB_FILE = join(NOTES_DIR, 'AI Workshop.md');
const SCHEDULE_FILE = join(ROOT, 'data', 'schedule.json');
const BACKLOG_FILE = join(ROOT, 'data', 'backlog.json');
const OUT_FILE = join(ROOT, 'src', 'data.json');
const SESSION_PHOTOS_DIR = join(ROOT, 'public', 'sessions');

// Collected during parsing, printed after the summary line.
const warnings = [];

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

// Falling back to the committed snapshot is correct for a deploy, but it used
// to be a quiet `console.log` + exit 0 — which is how the dashboard shipped
// months-old data while every build reported success. Say it loudly, and report
// how stale the snapshot actually is.
if (!existsSync(SESSIONS_DIR)) {
  if (!existsSync(OUT_FILE)) {
    console.error(`build-data: FATAL — notes dir not found (${SESSIONS_DIR}) and no src/data.json snapshot to fall back on.`);
    console.error('build-data: set AI_WORKSHOP_NOTES_DIR to the vault path, or commit a src/data.json snapshot.');
    process.exit(1);
  }
  let ageNote = '';
  try {
    const snap = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    if (snap.generatedAt) {
      const days = Math.floor((Date.now() - new Date(snap.generatedAt)) / 86400000);
      ageNote = ` (generated ${snap.generatedAt.slice(0, 10)}, ${days} day(s) ago)`;
    }
  } catch {
    /* snapshot unreadable — the warning below still stands */
  }
  console.warn(`build-data: WARNING — notes dir not found (${SESSIONS_DIR}).`);
  console.warn(`build-data: WARNING — serving the committed src/data.json snapshot${ageNote}. Session notes will NOT be current.`);
  process.exit(0);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
// Labels are spliced into a RegExp; an unescaped "(" silently matches nothing.
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

function parseSessionFile(filename) {
  const m = filename.match(/^#(\d+)\s+SESSION\s+(\d{4}-\d{2}-\d{2})\.md$/);
  if (!m) return null;
  const number = parseInt(m[1], 10);
  const date = m[2];
  const raw = read(join(SESSIONS_DIR, filename));

  const get = (label) => {
    const re = new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*([^\\n]*)`, 'i');
    const hit = raw.match(re);
    return hit ? hit[1].trim() : '';
  };
  const location = get('Location');
  const attendees = (get('Attendees') || get('Attendees (in-person)') || '')
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

  // Action items. Only the FIRST such section is read (the lookahead stops at
  // the next `## `), so warn rather than silently dropping a duplicate.
  if ((raw.match(/^## Action Items/gm) || []).length > 1) {
    warnings.push(`${filename} has more than one "## Action Items" section — only the first is parsed.`);
  }
  // `\Z` is not a JS anchor — it matched a literal "Z", truncating the block at
  // the first capital Z in the text. `(?![\s\S])` is a real end-of-input assert
  // ($ alone would match every line end under the /m flag).
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

  const photos = listSessionPhotosForDate(date);
  return { number, date, location, attendees, demos, actions, summary, photos };
}

function parseHub() {
  const raw = read(HUB_FILE);
  // Members table
  // `\n\n` alone assumed content always follows the table — if the table is the
  // last thing in the file, members silently came back empty. Same latent shape
  // as the `\Z` bug above; terminate on a blank line OR true end-of-input.
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
    location: '',
    attendees: [],
    demos: [],
    actions: [],
    summary: '',
    photos,
  });
}
sessions.sort((a, b) => a.date.localeCompare(b.date));

const { members, hubActions } = parseHub();
const schedule = readJson(SCHEDULE_FILE) || { upcoming: [], gaps: [] };
const backlog = readJson(BACKLOG_FILE) || [];

// The schedule is hand-maintained, so it runs out silently. Surface that in the
// build log — an unattended CI/Vercel build has no browser to show the in-app
// warning, and this is exactly how the dashboard sat with an expired schedule.
const RUNWAY_WARN_DAYS = 21;

function validateSchedule(sched, allSessions) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = Array.isArray(sched?.upcoming) ? sched.upcoming : [];
  if (!Array.isArray(sched?.upcoming)) {
    warnings.push('schedule.json has no "upcoming" array — the dashboard will show an empty schedule.');
    return;
  }
  const future = upcoming.filter((s) => s?.date >= todayIso).map((s) => s.date).sort();
  if (future.length === 0) {
    warnings.push(`schedule.json has no dates on or after ${todayIso} — "Next session" will be empty.`);
  } else {
    const last = future[future.length - 1];
    const daysLeft = Math.round((new Date(`${last}T12:00:00Z`) - new Date(`${todayIso}T12:00:00Z`)) / 86400000);
    if (daysLeft < RUNWAY_WARN_DAYS) {
      warnings.push(`schedule.json runs out in ${daysLeft} day(s) (last date ${last}) — add more dates.`);
    }
  }
  // A gap window that contains a logged session is a data error; gaps are typed
  // by hand and nothing else checks them.
  const sessionDates = allSessions.map((s) => s.date);
  for (const gap of Array.isArray(sched?.gaps) ? sched.gaps : []) {
    const inside = sessionDates.filter((d) => d >= gap.from && d <= gap.to);
    if (inside.length) {
      warnings.push(`schedule.json gap ${gap.from}→${gap.to} contains logged session(s): ${inside.join(', ')}.`);
    }
  }
}

validateSchedule(schedule, sessions);

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
const upcomingCount = Array.isArray(schedule.upcoming) ? schedule.upcoming.length : 0;
console.log(`build-data: ${sessions.length} sessions, ${members.length} members, ${upcomingCount} upcoming, ${allActions.length} open actions → src/data.json`);
for (const w of warnings) console.warn(`build-data: WARNING — ${w}`);
