// Repeatable pre-deploy audit. Checks the things that silently regress:
// bundle weight, security headers, meta completeness, image budget and the
// data freshness that this dashboard has been bitten by before.
//
//   node scripts/audit.mjs            # static checks only
//   AUDIT_URL=http://127.0.0.1:3003 node scripts/audit.mjs   # + live headers

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const BUDGET_JS_KB = 320;
const BUDGET_CSS_KB = 60;
const BUDGET_IMAGE_MB = 10;

let failures = 0;
let warnings = 0;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => { warnings++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const fail = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const section = (m) => console.log(`\n${m}`);

// ------------------------------------------------------------------ bundle --
section('Bundle');
if (!existsSync(DIST)) {
  fail('dist/ missing — run `npm run build` first');
} else {
  const assets = join(DIST, 'assets');
  const files = existsSync(assets) ? readdirSync(assets) : [];
  const sum = (ext) =>
    files.filter((f) => f.endsWith(ext)).reduce((n, f) => n + statSync(join(assets, f)).size, 0) / 1024;
  const js = sum('.js');
  const css = sum('.css');
  (js <= BUDGET_JS_KB ? ok : fail)(`JS ${js.toFixed(0)} KB (budget ${BUDGET_JS_KB} KB)`);
  (css <= BUDGET_CSS_KB ? ok : fail)(`CSS ${css.toFixed(0)} KB (budget ${BUDGET_CSS_KB} KB)`);
  const chunks = files.filter((f) => f.endsWith('.js')).length;
  (chunks > 1 ? ok : warn)(`${chunks} JS chunk(s) — code splitting ${chunks > 1 ? 'active' : 'not applied'}`);
}

// -------------------------------------------------------------------- meta --
section('HTML meta');
const htmlPath = join(DIST, 'index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8');
  const need = [
    ['description', /<meta\s+name="description"/],
    ['og:title', /property="og:title"/],
    ['og:image', /property="og:image"/],
    ['twitter:card', /name="twitter:card"/],
    ['canonical', /rel="canonical"/],
    ['theme-color', /name="theme-color"/],
    ['favicon', /rel="icon"/],
  ];
  for (const [name, re] of need) (re.test(html) ? ok : fail)(`${name} present`);
  (!html.includes('%VITE_') ? ok : fail)('no unsubstituted template tokens');
  (!/fonts\.googleapis/.test(html) ? ok : warn)('no third-party font origins');
} else {
  fail('dist/index.html missing');
}

// ------------------------------------------------------------------ assets --
section('Static assets');
for (const f of ['robots.txt', 'sitemap.xml', 'favicon.svg', 'og-cover.jpg']) {
  (existsSync(join(ROOT, 'public', f)) ? ok : fail)(`public/${f}`);
}
let imageBytes = 0;
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(png|jpe?g|webp|gif|avif)$/i.test(entry)) imageBytes += st.size;
  }
};
walk(join(ROOT, 'public'));
const imageMb = imageBytes / 1048576;
(imageMb <= BUDGET_IMAGE_MB ? ok : warn)(`image payload ${imageMb.toFixed(2)} MB (budget ${BUDGET_IMAGE_MB} MB)`);

// -------------------------------------------------------------------- data --
section('Data freshness');
try {
  const snap = JSON.parse(readFileSync(join(ROOT, 'src', 'data.json'), 'utf8'));
  const days = Math.floor((Date.now() - new Date(snap.generatedAt)) / 86400000);
  (days <= 45 ? ok : warn)(`data.json built ${days} day(s) ago`);
  const today = new Date().toISOString().slice(0, 10);
  const future = (snap.schedule?.upcoming || []).filter((s) => s.date >= today);
  (future.length >= 3 ? ok : fail)(`${future.length} future session(s) scheduled`);
} catch (e) {
  fail(`could not read src/data.json (${e.message})`);
}
try {
  const news = JSON.parse(readFileSync(join(ROOT, 'data', 'news.json'), 'utf8'));
  const newest = news.items.map((i) => i.date).sort().pop();
  const age = Math.floor((Date.now() - new Date(`${newest}T12:00:00Z`)) / 86400000);
  (age <= 45 ? ok : warn)(`newest news item is ${age} day(s) old`);
} catch (e) {
  warn(`could not read data/news.json (${e.message})`);
}

// ----------------------------------------------------------------- headers --
const url = process.env.AUDIT_URL;
if (url) {
  section(`Live headers (${url})`);
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const expect = [
      ['content-security-policy', /default-src 'self'/],
      ['x-content-type-options', /nosniff/],
      ['referrer-policy', /strict-origin/],
      ['x-frame-options', /DENY/i],
      ['permissions-policy', /camera=\(\)/],
    ];
    for (const [header, re] of expect) {
      const v = res.headers.get(header);
      (v && re.test(v) ? ok : fail)(`${header}${v ? '' : ' missing'}`);
    }
    const cc = res.headers.get('cache-control') || '';
    (/no-cache/.test(cc) ? ok : fail)(`index.html cache-control: ${cc || 'unset'}`);
  } catch (e) {
    fail(`could not reach ${url} (${e.message})`);
  }
} else {
  section('Live headers');
  console.log('  skipped — set AUDIT_URL to check a running server');
}

console.log(`\n${failures === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} · ${failures} failure(s), ${warnings} warning(s)\n`);
process.exit(failures === 0 ? 0 : 1);
