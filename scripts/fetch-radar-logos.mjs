// Downloads a brand mark for each Radar entry that has an official site, and
// writes it to public/radar/<id>.png at 96px.
//
//   node scripts/fetch-radar-logos.mjs [id ...]
//
// Why download rather than hotlink: the site's CSP is `img-src 'self'` plus a
// short allowlist (vercel.json), so a remote logo would be blocked silently and
// the card would show a hole. Serving them ourselves also means no third-party
// request per card, and no card breaking the day somebody reorganises their CDN.
//
// Entries without an official site (the thematic ones, "Open-weight models",
// "The frontier price war") get no file and fall back to the generated Sigil in
// Radar.jsx. That is deliberate: a theme has no logo to be honest about.
//
// Marks are used editorially, to identify the thing being written about. Keep it
// that way: no logo goes on a button, a badge, or anything implying endorsement.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = 'public/radar';
const SIZE = 96;
const UA = 'Mozilla/5.0 (compatible; AISundaysRadar/1.0; +https://www.aisundays.org)';

// Where to look for each entry's mark. A homepage is enough for most: the icon
// is discovered from its <link rel="icon"> tags. A direct URL wins when the
// favicon is a generic org mark rather than the product's own.
const SOURCES = {
  opencode: 'https://opencode.ai/',
  'claude-code': 'https://claude.com/',
  cursor: 'https://cursor.com/',
  'gemini-cli': 'https://github.com/google-gemini/gemini-cli',
  mcp: 'https://modelcontextprotocol.io/',
  'ai-sdk': 'https://ai-sdk.dev/',
  'wispr-flow': 'https://wisprflow.ai/',
  granola: 'https://www.granola.ai/',
  ollama: 'https://ollama.com/',
  'image-models': 'https://bfl.ai/',
  'agents-md': 'https://agents.md/',
  langfuse: 'https://langfuse.com/',
  'gemini-notebook': 'https://notebooklm.google/',
  n8n: 'https://n8n.io/',
};

// Direct icon URLs, for the sites where discovery finds the wrong thing or
// nothing at all: a GitHub-hosted project whose favicon is GitHub's own octocat,
// a homepage that redirects to a sign-in wall, or a site with no <link rel=icon>
// in its served HTML at all.
const DIRECT = {
  // Discovery on the GitHub repo page returns GitHub's octocat, not Gemini's mark.
  'gemini-cli': 'https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png',
  // claude.com exposes only a 32px favicon; anthropic.com has a real webclip.
  'claude-code': 'https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67d31dd7aa394792257596c5_webclip.png',
  // Neither ships <link rel="icon"> in the HTML we get back. n8n serves the
  // conventional path anyway; ai-sdk.dev 500s on every PNG path and offers only
  // an .ico, which sharp cannot decode, so the SDK wears its publisher's mark.
  'ai-sdk': 'https://assets.vercel.com/image/upload/q_auto/front/favicon/vercel/apple-touch-icon-180x180.png',
  n8n: 'https://n8n.io/apple-touch-icon.png',
};

const only = process.argv.slice(2);
const radar = JSON.parse(readFileSync('data/radar.json', 'utf8'));
mkdirSync(OUT, { recursive: true });

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
  const re = /<link\b[^>]*>/gi;
  for (const tag of html.match(re) || []) {
    const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1] || '';
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href || !/icon/i.test(rel)) continue;
    const sizes = (tag.match(/\bsizes=["'](\d+)/i) || [])[1];
    // Rank: apple-touch-icon (always a square raster, usually 180px) beats a
    // declared large size, beats an svg, beats whatever is left.
    const rank = /apple-touch/i.test(rel) ? 0
      : sizes ? 1000 - Number(sizes)
      : /\.svg($|\?)/i.test(href) ? 500
      : 900;
    try { out.push({ rank, url: new URL(href, pageUrl).href }); } catch { /* skip junk href */ }
  }
  out.push({ rank: 9999, url: new URL('/favicon.ico', pageUrl).href });
  return [...new Map(out.sort((a, b) => a.rank - b.rank).map((c) => [c.url, c])).values()];
}

/**
 * `contain` on a transparent canvas, so a wide wordmark and a square glyph both
 * land in the same box without being stretched or cropped.
 */
async function toPng(buf) {
  return sharp(buf, { density: 384 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

let ok = 0; let failed = [];
const ids = Object.keys(SOURCES).filter((id) => (only.length ? only.includes(id) : true));

for (const id of ids) {
  if (!radar.items.some((i) => i.id === id)) { console.log(`  skip ${id} (not in radar.json)`); continue; }
  const page = SOURCES[id];
  try {
    const candidates = DIRECT[id]
      ? [{ rank: -1, url: DIRECT[id] }]
      : iconCandidates(await get(page), page).slice(0, 5);
    let saved = false;
    for (const cand of candidates) {
      try {
        const buf = await get(cand.url, 'buffer');
        if (buf.length < 100) continue;                     // an HTML error page, not an icon
        writeFileSync(join(OUT, `${id}.png`), await toPng(buf));
        console.log(`  ok   ${id}  <- ${cand.url}`);
        saved = true; ok++;
        break;
      } catch { /* try the next candidate */ }
    }
    if (!saved) { failed.push(id); console.log(`  FAIL ${id}  no usable icon on ${page}`); }
  } catch (e) {
    failed.push(id);
    console.log(`  FAIL ${id}  ${e.message}`);
  }
}

// Record which entries have a mark, so the component knows without probing for a
// 404 on every card. An entry whose file is missing loses the field and falls
// back to the generated Sigil, which is what the thematic entries do for good.
let changed = 0;
for (const item of radar.items) {
  const path = existsSync(join(OUT, `${item.id}.png`)) ? `/radar/${item.id}.png` : undefined;
  if (item.logo === path) continue;
  if (path) item.logo = path; else delete item.logo;
  changed++;
}
if (changed) {
  writeFileSync('data/radar.json', `${JSON.stringify(radar, null, 2)}\n`);
  console.log(`\ndata/radar.json: ${changed} logo field(s) updated`);
}

console.log(`\n${ok} saved, ${failed.length} failed${failed.length ? `: ${failed.join(', ')}` : ''}`);
console.log(`${radar.items.filter((i) => i.logo).length} of ${radar.items.length} entries have a mark, the rest use the generated one.`);
