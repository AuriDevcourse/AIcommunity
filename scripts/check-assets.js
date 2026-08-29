// Reports assets in public/ that nothing references, and images large enough to
// hurt page load. Everything under public/ is copied verbatim into dist/, so an
// image left behind by an old news roundup keeps shipping to every visitor.
//
// Read-only by design: run `npm run check:assets` to see the list, then delete
// what you actually want gone. Pass --delete-unused-news to remove the
// unreferenced news images (they are in git, so it is reversible).

import { readFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEWS_FILE = join(ROOT, 'data', 'news.json');
const NEWS_IMAGES = join(ROOT, 'public', 'news-images');
const SESSIONS_DIR = join(ROOT, 'public', 'sessions');
const MEMBERS_DIR = join(ROOT, 'public', 'members');
const PROFILE_FILE = join(ROOT, 'data', 'members-profile.json');

const LARGE_IMAGE_KB = 400;
const MB = 1048576;

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const kb = (bytes) => Math.round(bytes / 1024);
const basename = (p) => String(p).split('/').pop();

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !f.startsWith('.'));
}

function report(title, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('  none');
    return;
  }
  for (const r of rows) console.log(`  ${r}`);
}

// ---------------------------------------------------------------- news --
const news = readJson(NEWS_FILE) || { items: [] };
const referenced = new Set((news.items || []).map((i) => i.image).filter(Boolean).map(basename));
const newsFiles = listFiles(NEWS_IMAGES);
const unusedNews = newsFiles.filter((f) => !referenced.has(f));
const unusedBytes = unusedNews.reduce((sum, f) => sum + statSync(join(NEWS_IMAGES, f)).size, 0);

report(
  `Unreferenced news images (${unusedNews.length} of ${newsFiles.length}, ${(unusedBytes / MB).toFixed(2)} MB)`,
  unusedNews.map((f) => `${f}  ${kb(statSync(join(NEWS_IMAGES, f)).size)} KB`)
);

// -------------------------------------------------------------- members --
const profiles = readJson(PROFILE_FILE) || {};
const usedMemberPhotos = new Set(
  Object.values(profiles).map((p) => p?.photo).filter(Boolean).map(basename)
);
const unusedMembers = listFiles(MEMBERS_DIR).filter((f) => !usedMemberPhotos.has(f));
report(`Unreferenced member photos (${unusedMembers.length})`, unusedMembers);

const missingPhotos = Object.entries(profiles)
  .filter(([, p]) => p?.photo && !existsSync(join(ROOT, 'public', p.photo.replace(/^\//, ''))))
  .map(([name, p]) => `${name} → ${p.photo} (file missing)`);
report(`Member photos referenced but absent (${missingPhotos.length})`, missingPhotos);

const missingNews = (news.items || [])
  .filter((i) => i.image && !existsSync(join(ROOT, 'public', i.image.replace(/^\//, ''))))
  .map((i) => `${i.id} → ${i.image} (file missing)`);
report(`News images referenced but absent (${missingNews.length})`, missingNews);

// ------------------------------------------------------------ oversized --
const oversized = [];
let shippedBytes = 0;
for (const dir of [NEWS_IMAGES, MEMBERS_DIR]) {
  for (const f of listFiles(dir)) {
    const size = statSync(join(dir, f)).size;
    shippedBytes += size;
    if (size > LARGE_IMAGE_KB * 1024) oversized.push(`${f}  ${kb(size)} KB`);
  }
}
for (const sub of listFiles(SESSIONS_DIR)) {
  const dir = join(SESSIONS_DIR, sub);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of listFiles(dir)) {
    const size = statSync(join(dir, f)).size;
    shippedBytes += size;
    if (size > LARGE_IMAGE_KB * 1024) oversized.push(`${sub}/${f}  ${kb(size)} KB`);
  }
}
report(`Images over ${LARGE_IMAGE_KB} KB (${oversized.length}) — these are served at full size`, oversized);

console.log(`\nTotal image payload in public/: ${(shippedBytes / MB).toFixed(2)} MB`);
if (unusedNews.length) {
  console.log(`Removing the unreferenced news images would save ${(unusedBytes / MB).toFixed(2)} MB per deploy.`);
  console.log('Run `npm run check:assets -- --delete-unused-news` to delete them (recoverable via git).');
}

if (process.argv.includes('--delete-unused-news')) {
  for (const f of unusedNews) unlinkSync(join(NEWS_IMAGES, f));
  console.log(`\nDeleted ${unusedNews.length} unreferenced news image(s).`);
}
