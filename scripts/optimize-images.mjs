// In-place, idempotent image optimizer. Downscales oversized images and
// recompresses them so the site ships KB-not-MB assets (raw camera photos were
// up to ~5MB each). Originals remain recoverable in git history.
//
// A manifest (scripts/.image-opt-manifest.json) records each file's optimized
// byte size. A re-run — including every Vercel build — skips files whose current
// size matches the manifest, so we never re-compress an already-optimized file
// (which would slowly degrade quality) and the build stays fast. A new or
// replaced file has a size the manifest doesn't know, so it gets processed.
import sharp from 'sharp';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const MANIFEST = join(__dirname, '.image-opt-manifest.json');

// Per-area budgets. maxW caps the longest displayed size: session covers/lightbox
// never need more than ~1600px, news cards ~1280px, member avatars ~640px.
const TARGETS = [
  { dir: 'sessions',    maxW: 1600, quality: 78 },
  { dir: 'news-images', maxW: 1280, quality: 80 },
  { dir: 'members',     maxW: 640,  quality: 82 },
];

const RASTER = /\.(jpe?g|png|webp)$/i;
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (RASTER.test(name)) out.push(p);
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function optimize(file, { maxW, quality }) {
  const rel = file.slice(PUBLIC.length + 1).replace(/\\/g, '/');
  const size = statSync(file).size;
  if (manifest[rel] === size) return { skipped: true };

  const input = readFileSync(file);
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const ext = extname(file).toLowerCase();

  let pipe = sharp(input, { failOn: 'none' }).rotate(); // bake in EXIF orientation
  if (meta.width && meta.width > maxW) pipe = pipe.resize({ width: maxW, withoutEnlargement: true });
  if (ext === '.png') pipe = pipe.png({ quality, compressionLevel: 9, effort: 8, palette: true });
  else if (ext === '.webp') pipe = pipe.webp({ quality });
  else pipe = pipe.jpeg({ quality, mozjpeg: true });

  const out = await pipe.toBuffer();
  if (out.length < size) {
    writeFileSync(file, out);
    manifest[rel] = out.length;
    return { before: size, after: out.length, rel };
  }
  manifest[rel] = size; // won't shrink — record so we don't retry it
  return { before: size, after: size, nochange: true, rel };
}

let processed = 0, skipped = 0, before = 0, after = 0;
for (const { dir, ...opts } of TARGETS) {
  for (const file of walk(join(PUBLIC, dir))) {
    const r = await optimize(file, opts);
    if (r.skipped) { skipped++; continue; }
    processed++; before += r.before; after += r.after;
    if (!r.nochange) console.log(`  ${r.rel}  ${kb(r.before)} -> ${kb(r.after)}`);
  }
}

// Hero banner: a 3.4MB PNG shown above the fold on every tab. Emit a small WebP
// (referenced from App.jsx). Keyed on the source PNG size so it regenerates only
// if the source changes.
const heroPng = join(PUBLIC, 'brand', 'hero.png');
const heroWebp = join(PUBLIC, 'brand', 'hero.webp');
if (existsSync(heroPng)) {
  const srcSize = statSync(heroPng).size;
  const sig = `hero.png:${srcSize}`;
  if (manifest.__hero !== sig || !existsSync(heroWebp)) {
    const out = await sharp(readFileSync(heroPng)).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    writeFileSync(heroWebp, out);
    manifest.__hero = sig;
    console.log(`  brand/hero.webp  ${kb(srcSize)} -> ${kb(out.length)} (from hero.png)`);
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
const saved = before - after;
console.log(`optimize-images: ${processed} optimized, ${skipped} unchanged · saved ${(saved / 1048576).toFixed(1)}MB (${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB)`);
