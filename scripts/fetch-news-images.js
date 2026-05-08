// Fetches og:image / twitter:image from each news source URL,
// downloads to public/news-images/, writes back image path into news.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NEWS_FILE = join(ROOT, 'data', 'news.json');
const IMG_DIR = join(ROOT, 'public', 'news-images');

if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function extractMeta(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&#x2F;/g, '/').replace(/&quot;/g, '"');
}

function extOf(url) {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function timedFetch(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(t);
  }
}

async function getOgImageFromPage(pageUrl) {
  try {
    const res = await timedFetch(pageUrl);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    const img = extractMeta(html);
    if (!img) return { ok: false, reason: 'no og:image tag' };
    const abs = new URL(img, pageUrl).toString();
    return { ok: true, imgUrl: abs };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function downloadImage(imgUrl, outPath) {
  try {
    const res = await timedFetch(imgUrl, 20000);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('svg')) return { ok: false, reason: 'SVG (likely logo)' };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 20000) return { ok: false, reason: `too small (${(buf.byteLength / 1024).toFixed(1)}KB)` };
    const head = Buffer.from(buf.slice(0, 200)).toString('utf8').toLowerCase();
    if (head.includes('<svg') || head.includes('<?xml')) return { ok: false, reason: 'SVG content' };
    writeFileSync(outPath, Buffer.from(buf));
    return { ok: true, bytes: buf.byteLength };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

const news = JSON.parse(readFileSync(NEWS_FILE, 'utf8'));
const onlyIds = process.argv.slice(2);
const results = [];

for (const item of news.items) {
  if (onlyIds.length && !onlyIds.includes(item.id)) continue;
  let saved = false;
  let chosenSource = null;
  let lastReason = '';

  // Try sources in order until one yields a usable image
  for (const src of item.sources) {
    const og = await getOgImageFromPage(src.url);
    if (!og.ok) { lastReason = `${src.name}: ${og.reason}`; continue; }

    const ext = extOf(og.imgUrl);
    const outName = `${item.id}.${ext}`;
    const outPath = join(IMG_DIR, outName);

    const dl = await downloadImage(og.imgUrl, outPath);
    if (!dl.ok) { lastReason = `${src.name}: ${dl.reason}`; continue; }

    item.image = `/news-images/${outName}`;
    item.imageSource = src.name;
    chosenSource = src.name;
    saved = true;
    results.push({ id: item.id, ok: true, source: src.name, bytes: dl.bytes });
    break;
  }

  if (!saved) {
    item.image = null;
    results.push({ id: item.id, ok: false, reason: lastReason });
  }
}

writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));

const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.log(`fetch-news-images: ${ok} fetched · ${fail} failed`);
for (const r of results) {
  if (r.ok) console.log(`  ✓ ${r.id} (${r.source}, ${(r.bytes / 1024).toFixed(0)}KB)`);
  else      console.log(`  ✗ ${r.id} — ${r.reason}`);
}
