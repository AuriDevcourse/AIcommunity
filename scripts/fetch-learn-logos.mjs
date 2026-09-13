// Downloads the brand marks the Learn decks refer to, into public/learn/<id>.png.
//
//   node scripts/fetch-learn-logos.mjs
//
// Same reason as scripts/fetch-radar-logos.mjs: the site's CSP is `img-src
// 'self'` (vercel.json), so a hotlinked logo is blocked silently and the slide
// shows a hole. Serving them ourselves also means no third-party request per
// slide.
//
// These marks are used editorially, to identify the companies a case study is
// about. Keep it that way: no logo goes on a button, a badge, or anything that
// would read as endorsement or partnership.

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/learn';
const SIZE = 128;
const UA = 'Mozilla/5.0 (compatible; AISundaysLearn/1.0; +https://www.aisundays.org)';

const SOURCES = {
  openai: 'https://openai.com/',
  huggingface: 'https://huggingface.co/',
};

// Where discovery finds the wrong thing or nothing at all.
// openai.com answers 403 to every automated request, homepage and favicon
// alike, so the mark comes from Wikimedia Commons instead. Hugging Face serves
// its own asset happily.
const DIRECT = {
  openai: 'https://upload.wikimedia.org/wikipedia/commons/6/66/OpenAI_logo_2025_%28symbol%29.svg',
  huggingface: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
};

const get = (url, as = 'text') => fetch(url, {
  headers: { 'user-agent': UA, accept: '*/*' },
  redirect: 'follow',
}).then(async (r) => {
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'buffer' ? Buffer.from(await r.arrayBuffer()) : r.text();
});

/** Icon candidates from a page's <link rel="...icon...">, best first. */
function iconCandidates(html, pageUrl) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1] || '';
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href || !/icon/i.test(rel)) continue;
    const sizes = (tag.match(/\bsizes=["'](\d+)/i) || [])[1];
    const rank = /apple-touch/i.test(rel) ? 0
      : sizes ? 1000 - Number(sizes)
        : /\.svg($|\?)/i.test(href) ? 500
          : 900;
    try { out.push({ rank, url: new URL(href, pageUrl).href }); } catch { /* skip junk href */ }
  }
  out.push({ rank: 9999, url: new URL('/favicon.ico', pageUrl).href });
  return [...new Map(out.sort((a, b) => a.rank - b.rank).map((c) => [c.url, c])).values()];
}

// `contain` on a transparent canvas, so a wide wordmark and a square glyph both
// land in the same box without being stretched or cropped.
const toPng = (buf) => sharp(buf, { density: 384 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

mkdirSync(OUT, { recursive: true });
const failed = [];

for (const [id, page] of Object.entries(SOURCES)) {
  const candidates = DIRECT[id] ? [{ url: DIRECT[id] }] : iconCandidates(await get(page), page).slice(0, 5);
  let saved = false;
  for (const cand of candidates) {
    try {
      const buf = await get(cand.url, 'buffer');
      if (buf.length < 100) continue;             // an HTML error page, not an icon
      writeFileSync(`${OUT}/${id}.png`, await toPng(buf));
      console.log(`  ok   ${id.padEnd(12)} ${cand.url}`);
      saved = true;
      break;
    } catch { /* try the next candidate */ }
  }
  if (!saved) failed.push(id);
}

if (failed.length) {
  console.error(`\nno mark found for: ${failed.join(', ')}`);
  console.error('Add a direct URL to DIRECT above. A slide with no mark falls back to a glyph.');
  process.exit(1);
}
console.log(`\n${Object.keys(SOURCES).length} marks in ${OUT}/`);
