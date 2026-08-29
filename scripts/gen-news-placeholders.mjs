// Some stories only exist on aggregators that share one og:image across every
// item, or block fetching entirely — which leaves several news cards showing the
// same picture, or none. This renders a distinct typographic card per story so
// the grid still reads as twelve separate things.
//
//   node scripts/gen-news-placeholders.mjs          # fill gaps + duplicates
//   node scripts/gen-news-placeholders.mjs --force  # regenerate all placeholders
//
// Needs headless Chrome; writes into public/news-images/ and updates news.json.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEWS = join(ROOT, 'data', 'news.json');
const IMG_DIR = join(ROOT, 'public', 'news-images');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FORCE = process.argv.includes('--force');

const PALETTE = {
  global: { bg: '#12161c', fg: '#f4f6f8', accent: '#7fb2ff', label: 'Global' },
  europe: { bg: '#101a17', fg: '#f2f7f4', accent: '#6fd3a8', label: 'Europe' },
};

const news = JSON.parse(readFileSync(NEWS, 'utf8'));

// Which items need one: no image, or an image byte-identical to another item's.
const hashes = new Map();
for (const item of news.items) {
  if (!item.image) continue;
  const p = join(ROOT, 'public', item.image.replace(/^\//, ''));
  if (!existsSync(p)) continue;
  const h = createHash('md5').update(readFileSync(p)).digest('hex');
  if (!hashes.has(h)) hashes.set(h, []);
  hashes.get(h).push(item.id);
}
const duplicated = new Set();
for (const ids of hashes.values()) if (ids.length > 1) ids.forEach((id) => duplicated.add(id));

const targets = news.items.filter(
  (i) => FORCE || !i.image || duplicated.has(i.id) || i.imageSource === 'generated'
);

if (targets.length === 0) {
  console.log('gen-news-placeholders: nothing to do');
  process.exit(0);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardHtml(item) {
  const p = PALETTE[item.category] || PALETTE.global;
  const date = new Date(`${item.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  // Long headlines get a smaller size so nothing overflows the card.
  const len = item.title.length;
  const size = len > 64 ? 46 : len > 44 ? 54 : 62;
  return `<html><head><style>
    *{margin:0;box-sizing:border-box}
    body{width:1200px;height:675px;background:${p.bg};color:${p.fg};
      font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;padding:72px;
      display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
    .glow{position:absolute;width:760px;height:760px;right:-240px;top:-300px;border-radius:50%;
      background:radial-gradient(circle,${p.accent}26 0%,transparent 68%)}
    .top{display:flex;align-items:center;gap:16px;position:relative}
    .tag{font-size:20px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${p.accent}}
    .rule{flex:1;height:1px;background:${p.fg}1f}
    .date{font-size:20px;color:${p.fg}8c}
    h1{font-size:${size}px;line-height:1.08;letter-spacing:-.025em;font-weight:700;position:relative;max-width:1010px}
    .sub{font-size:25px;color:${p.fg}9e;margin-top:22px;max-width:900px;line-height:1.36;position:relative}
    .foot{font-size:19px;color:${p.fg}70;position:relative;letter-spacing:.01em}
  </style></head><body>
    <div class="glow"></div>
    <div class="top"><span class="tag">${p.label}</span><span class="rule"></span><span class="date">${esc(date)}</span></div>
    <div>
      <h1>${esc(item.title)}</h1>
      ${item.subtitle ? `<p class="sub">${esc(item.subtitle)}</p>` : ''}
    </div>
    <div class="foot">AI Workshop · Copenhagen &nbsp;·&nbsp; ${esc(item.sources?.[0]?.name || 'Roundup')}</div>
  </body></html>`;
}

function shoot(htmlPath, outPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--force-color-profile=srgb',
      '--virtual-time-budget=3000', '--window-size=1200,675',
      `--screenshot=${outPath}`, `file://${htmlPath}`,
    ], { stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exit ${code}`))));
    p.on('error', reject);
  });
}

let made = 0;
for (const item of targets) {
  const html = join('/tmp', `news-card-${item.id}.html`);
  const png = join(IMG_DIR, `${item.id}-card.png`);
  writeFileSync(html, cardHtml(item));
  try {
    await shoot(html, png);
    item.image = `/news-images/${item.id}-card.png`;
    item.imageSource = 'generated';
    made++;
    console.log(`  ✓ ${item.id}`);
  } catch (e) {
    console.log(`  ✗ ${item.id} — ${e.message}`);
  }
}

writeFileSync(NEWS, `${JSON.stringify(news, null, 2)}\n`);
console.log(`gen-news-placeholders: ${made} card(s) generated`);
