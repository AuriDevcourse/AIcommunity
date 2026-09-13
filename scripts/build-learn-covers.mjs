// Draws the six Learn deck covers and writes them to public/learn/covers/.
//
//   npm run learn:covers
//
// Why these are drawn rather than generated. The first set was six cinematic
// stills on one locked style string: a dark room, one amber practical, film
// grain. As a set they were handsome and as thumbnails they failed, for two
// reasons that only show up on the index page.
//
//  1. They were the same picture. Five of the six were a brown room with a warm
//     dot in it, and at the ~400px a card actually gets, you could not tell the
//     security deck from the local-LLM deck without reading the title under it.
//     A thumbnail that needs its own caption is decoration.
//  2. Three were metaphors with no subject. A ring of light, a corridor of
//     doors, a seam under a wall. A ring says nothing about tool calls or stop
//     reasons, and the decks underneath had just been rewritten to be extremely
//     specific.
//
// So each cover now draws the deck's actual mechanism: what fits in memory, the
// loop with a tool in it, one ask read many ways, five doors with one open, a
// folder becoming a URL, a contained thing getting out. Drawn in code because a
// diagram wants exact brand colour, exact stroke weight and a silhouette tuned
// to 400px, none of which survives a generation roll.
//
// The set holds together through a system rather than a mood: one ground, one
// safe area, one stroke weight, one yellow accent per cover, no text anywhere.
//
// Traps worth knowing if you edit these (both cost a session before):
//  - Render with sharp. There is no cairo here.
//  - Keep `viewBox` camelCase. Lowercase works inline in HTML and is dead in a
//    standalone file.

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/learn/covers');

const W = 800, H = 450;

// The palette, straight off the brand page. Nothing here is invented: deep
// green ground, cream for the thing being talked about, yellow for the one part
// that matters on each cover, lime once and only where it earns it.
// Deliberately darker than --brand-deep. In dark theme the card ground is
// #103A26, and a cover painted on #0B2E1E dissolved into it: the thumbnail
// stopped reading as a picture and became the top of the card. This separates
// from the card in dark and from the cream page in light.
const GROUND = '#061D13';
const GREEN = '#124A30';
const CREAM = '#F8F0E4';
const YELLOW = '#F8B800';
const LIME = '#D4F53A';

// Every motif sits inside this box, so six different drawings crop the same way
// and line up with each other on the index.
const SAFE = { x: 70, y: 60, w: 660, h: 330 };

/** Ground, a soft pool of lighter green, and a hairline grid for texture. */
function stage(inner) {
  const grid = Array.from({ length: 9 }, (_, i) => {
    const x = 80 + i * 80;
    return `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${CREAM}" stroke-width="1" opacity="0.045"/>`;
  }).join('') + Array.from({ length: 5 }, (_, i) => {
    const y = 75 + i * 75;
    return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${CREAM}" stroke-width="1" opacity="0.045"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="pool" cx="50%" cy="45%" r="62%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${GROUND}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${YELLOW}"/>
      <stop offset="100%" stop-color="${LIME}"/>
    </linearGradient>
    <!-- A flat ellipse at low opacity reads as a shape someone drew by
         mistake, not as light. This has to fall off. -->
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${YELLOW}" stop-opacity="0.26"/>
      <stop offset="60%" stop-color="${YELLOW}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${YELLOW}" stop-opacity="0"/>
    </radialGradient>
    <!-- The part of a model that does not fit. It has to run out of the frame
         rather than stop at it, or the hard edge reads as a bug. -->
    <linearGradient id="spill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${YELLOW}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${YELLOW}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <rect width="${W}" height="${H}" fill="url(#pool)"/>
  ${grid}
  ${inner}
</svg>`;
}

// --------------------------------------------------------------------------
// prompting-basics · one ask, and every way it can be read
//
// A solid bar on the left fans into eleven thin readings on the right. One of
// them is the one you wanted, and nothing about the ask says which.
function prompting() {
  const originX = SAFE.x + 40, originY = H / 2;
  const endX = SAFE.x + SAFE.w - 30;
  const n = 11;
  const picked = 4;
  const rays = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const y = SAFE.y + 26 + t * (SAFE.h - 52);
    const on = i === picked;
    return `<path d="M ${originX + 150} ${originY} C ${originX + 300} ${originY}, ${endX - 190} ${y}, ${endX} ${y}"
      fill="none" stroke="${on ? YELLOW : CREAM}" stroke-width="${on ? 9 : 4}"
      opacity="${on ? 1 : 0.3}" stroke-linecap="round"/>`;
  }).join('');

  return stage(`
    ${rays}
    <rect x="${originX - 10}" y="${originY - 26}" width="165" height="52" rx="12" fill="${CREAM}"/>
    <rect x="${originX + 12}" y="${originY - 9}" width="86" height="8" rx="4" fill="${GROUND}" opacity="0.55"/>
    <rect x="${originX + 12}" y="${originY + 5}" width="46" height="8" rx="4" fill="${GROUND}" opacity="0.3"/>
    <circle cx="${endX}" cy="${SAFE.y + 26 + (picked / (n - 1)) * (SAFE.h - 52)}" r="14" fill="${YELLOW}"/>
  `);
}

// --------------------------------------------------------------------------
// first-agent · the loop, with a tool in it
//
// Four nodes on a ring with the arrows drawn in, because the deck's first slide
// is that an agent is those four boxes and everything else is plumbing. The
// tool node is the yellow one: the step that runs on your machine, not theirs.
function agentLoop() {
  const cx = W / 2, cy = H / 2, r = 122;
  const pts = [0, 1, 2, 3].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

  // The ring, drawn as four arcs so each one can carry an arrowhead.
  const arcs = pts.map((p, i) => {
    const q = pts[(i + 1) % 4];
    return `<path d="M ${p.x} ${p.y} A ${r} ${r} 0 0 1 ${q.x} ${q.y}" fill="none"
      stroke="${CREAM}" stroke-width="5" opacity="0.35"/>`;
  }).join('');

  const heads = pts.map((p, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2 + Math.PI / 4;
    const hx = cx + r * Math.cos(a), hy = cy + r * Math.sin(a);
    const rot = (a * 180) / Math.PI + 90;
    return `<path d="M -13 -11 L 0 0 L -13 11" fill="none" stroke="${CREAM}" stroke-width="6"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.8"
      transform="translate(${hx} ${hy}) rotate(${rot})"/>`;
  }).join('');

  const node = (p, on, glyph) => `
    <rect x="${p.x - 46}" y="${p.y - 34}" width="92" height="68" rx="16"
      fill="${on ? YELLOW : GROUND}" stroke="${on ? YELLOW : CREAM}" stroke-width="4" ${on ? '' : 'opacity="0.92"'}/>
    ${glyph(p, on ? GROUND : CREAM)}`;

  // Goal: a flag. Model: three stacked lines. Tool: a spanner. Result: a page.
  const flag = (p, c) => `<path d="M ${p.x - 12} ${p.y + 16} L ${p.x - 12} ${p.y - 16} L ${p.x + 14} ${p.y - 8} L ${p.x - 12} ${p.y}"
    fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const lines = (p, c) => [0, 1, 2].map((i) => `<rect x="${p.x - 20}" y="${p.y - 14 + i * 11}" width="${[40, 30, 36][i]}" height="6" rx="3" fill="${c}"/>`).join('');
  const spanner = (p, c) => `<path d="M ${p.x + 14} ${p.y - 16} a 12 12 0 1 0 -12 20 l -14 14 a 6 6 0 0 0 8 8 l 14 -14 a 12 12 0 0 0 14 -20 l -9 9 -9 -9 z"
    fill="${c}"/>`;
  const page = (p, c) => `<rect x="${p.x - 17}" y="${p.y - 18}" width="34" height="36" rx="5" fill="none" stroke="${c}" stroke-width="5"/>
    <rect x="${p.x - 8}" y="${p.y - 6}" width="16" height="4" rx="2" fill="${c}"/>
    <rect x="${p.x - 8}" y="${p.y + 3}" width="11" height="4" rx="2" fill="${c}"/>`;

  return stage(`
    ${arcs}${heads}
    ${node(pts[0], false, flag)}
    ${node(pts[1], false, lines)}
    ${node(pts[2], true, spanner)}
    ${node(pts[3], false, page)}
  `);
}

// --------------------------------------------------------------------------
// local-llm · what fits, and what spills
//
// Three identical tracks, one per machine, with the model laid into each. The
// third one runs off the end of its track, which is the deck's whole point: a
// model one size too big does not refuse, it hangs over the edge and crawls.
function localLlm() {
  const trackW = 470, x = SAFE.x + 120, h = 54, gap = 34;
  const rows = [
    { fill: 0.42, label: 3 },
    { fill: 0.78, label: 8 },
    { fill: 1.34, label: 32 },
  ];

  const body = rows.map((row, i) => {
    const y = SAFE.y + 46 + i * (h + gap);
    const over = row.fill > 1;
    const w = Math.min(row.fill, 1) * trackW;
    const spill = over ? (row.fill - 1) * trackW : 0;
    // The chip beside each track: the machine it stands for.
    const chip = `<rect x="${x - 96}" y="${y + 12}" width="72" height="30" rx="8" fill="${CREAM}" opacity="0.14"/>
      <rect x="${x - 82}" y="${y + 23}" width="44" height="8" rx="4" fill="${CREAM}" opacity="0.5"/>`;
    return `${chip}
      <rect x="${x}" y="${y}" width="${trackW}" height="${h}" rx="12" fill="none" stroke="${CREAM}" stroke-width="4" opacity="0.3"/>
      <rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="8" fill="${over ? YELLOW : CREAM}" opacity="${over ? 1 : 0.9}"/>
      ${over ? `<rect x="${x + trackW - 5}" y="${y + 5}" width="${Math.max(spill, W - (x + trackW) + 10)}" height="${h - 10}" fill="url(#spill)"/>
        <path d="M ${x + trackW} ${y - 10} L ${x + trackW} ${y + h + 10}" stroke="${YELLOW}" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round"/>` : ''}`;
  }).join('');

  return stage(body);
}

// --------------------------------------------------------------------------
// ship-with-claude-code · a folder becomes a URL
//
// What you type on the left, what the internet gets on the right, one arrow
// between them. The address bar is the only yellow thing on the cover.
function shipCode() {
  const tw = 268, th = 210, ty = SAFE.y + 58;
  const tx = SAFE.x + 6;
  const bx = SAFE.x + SAFE.w - tw - 6;

  const term = `
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="14" fill="${GROUND}" stroke="${CREAM}" stroke-width="4" opacity="0.95"/>
    <rect x="${tx}" y="${ty}" width="${tw}" height="34" rx="14" fill="${CREAM}" opacity="0.12"/>
    <rect x="${tx}" y="${ty + 20}" width="${tw}" height="14" fill="${CREAM}" opacity="0.12"/>
    ${[0, 1, 2].map((i) => `<circle cx="${tx + 22 + i * 18}" cy="${ty + 17}" r="5" fill="${CREAM}" opacity="0.4"/>`).join('')}
    ${[[48, 150], [74, 196], [100, 116]].map(([dy, w]) => `
      <rect x="${tx + 24}" y="${ty + dy}" width="10" height="9" rx="2" fill="${LIME}" opacity="0.9"/>
      <rect x="${tx + 42}" y="${ty + dy}" width="${w}" height="9" rx="4" fill="${CREAM}" opacity="0.55"/>`).join('')}
    <rect x="${tx + 24}" y="${ty + 126}" width="10" height="9" rx="2" fill="${LIME}" opacity="0.9"/>
    <rect x="${tx + 42}" y="${ty + 126}" width="16" height="9" rx="2" fill="${CREAM}" opacity="0.9"/>`;

  const browser = `
    <rect x="${bx}" y="${ty}" width="${tw}" height="${th}" rx="14" fill="${GROUND}" stroke="${CREAM}" stroke-width="4"/>
    <rect x="${bx}" y="${ty}" width="${tw}" height="34" rx="14" fill="${CREAM}" opacity="0.12"/>
    <rect x="${bx}" y="${ty + 20}" width="${tw}" height="14" fill="${CREAM}" opacity="0.12"/>
    <rect x="${bx + 16}" y="${ty + 8}" width="${tw - 32}" height="19" rx="9" fill="${YELLOW}"/>
    <rect x="${bx + 20}" y="${ty + 54}" width="${tw - 40}" height="62" rx="10" fill="${CREAM}" opacity="0.85"/>
    <rect x="${bx + 20}" y="${ty + 128}" width="${(tw - 48) / 2}" height="52" rx="10" fill="${CREAM}" opacity="0.35"/>
    <rect x="${bx + 28 + (tw - 48) / 2}" y="${ty + 128}" width="${(tw - 48) / 2}" height="52" rx="10" fill="${CREAM}" opacity="0.35"/>`;

  const midX = (tx + tw + bx) / 2, midY = ty + th / 2;
  const arrow = `
    <path d="M ${midX - 26} ${midY} L ${midX + 18} ${midY}" stroke="${YELLOW}" stroke-width="7" stroke-linecap="round"/>
    <path d="M ${midX + 6} ${midY - 13} L ${midX + 22} ${midY} L ${midX + 6} ${midY + 13}" fill="none" stroke="${YELLOW}"
      stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;

  return stage(`${term}${browser}${arrow}`);
}

// --------------------------------------------------------------------------
// vibe-code-security · five doors, one of them open
//
// The title says five, so there are five, and they are countable at thumbnail
// size. Four shackles closed, one open with the light coming through.
function security() {
  const n = 5, w = 104, gap = 30;
  const total = n * w + (n - 1) * gap;
  const x0 = (W - total) / 2;
  const y = SAFE.y + 54;
  const h = 226;
  const openAt = 2;

  const locks = Array.from({ length: n }, (_, i) => {
    const x = x0 + i * (w + gap);
    const on = i === openAt;
    const c = on ? YELLOW : CREAM;
    const op = on ? 1 : 0.42;
    // Shackle: closed ones land in the body, the open one is lifted and hinged.
    const shackle = on
      ? `<path d="M ${x + 22} ${y + 96} v -26 a 30 30 0 0 1 60 0 v 4" fill="none" stroke="${c}" stroke-width="11"
          stroke-linecap="round" transform="rotate(-16 ${x + 22} ${y + 96})"/>`
      : `<path d="M ${x + 26} ${y + 96} v -28 a 26 26 0 0 1 52 0 v 28" fill="none" stroke="${c}" stroke-width="11"
          stroke-linecap="round" opacity="${op}"/>`;
    return `${shackle}
      <rect x="${x}" y="${y + 92}" width="${w}" height="${h - 92}" rx="16" fill="${on ? YELLOW : 'none'}"
        stroke="${c}" stroke-width="9" opacity="${op}"/>
      <circle cx="${x + w / 2}" cy="${y + 150}" r="12" fill="${on ? GROUND : c}" opacity="${on ? 1 : op}"/>
      <rect x="${x + w / 2 - 5}" y="${y + 150}" width="10" height="30" rx="5" fill="${on ? GROUND : c}" opacity="${on ? 1 : op}"/>`;
  }).join('');

  const glow = `<ellipse cx="${x0 + openAt * (w + gap) + w / 2}" cy="${y + 150}" rx="210" ry="180" fill="url(#glow)"/>`;
  return stage(`${glow}${locks}`);
}

// --------------------------------------------------------------------------
// agent-breach · the thing that got out
//
// A sealed boundary with a crowd of agents inside it, and one bright path
// through the single gap, branching once it is outside. The dashes say the wall
// was meant to be there; the gap says it was not sealed.
function breach() {
  const bx = SAFE.x, by = SAFE.y + 26, bw = 300, bh = 278;
  const right = bx + bw;
  const gapTop = by + 104, gapBottom = by + 174;
  const escapeY = (gapTop + gapBottom) / 2;

  // The wall is one continuous dashed line except for the gap, so the hole is
  // the only thing that breaks the rhythm. The first version drew the right
  // side as two stubs off the same corner and they disappeared into it.
  const wall = `
    <path d="M ${right} ${gapTop} L ${right} ${by} L ${bx} ${by} L ${bx} ${by + bh} L ${right} ${by + bh} L ${right} ${gapBottom}"
      fill="none" stroke="${CREAM}" stroke-width="7" stroke-dasharray="16 11"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
    <!-- The two lips of the gap, solid, so the eye lands on the opening. -->
    <circle cx="${right}" cy="${gapTop}" r="6" fill="${CREAM}" opacity="0.55"/>
    <circle cx="${right}" cy="${gapBottom}" r="6" fill="${CREAM}" opacity="0.55"/>`;

  // The crowd. Fixed positions, because a random scatter re-rolls on every
  // build and the cover would never be the same picture twice.
  const seeds = [
    [0.2, 0.2], [0.45, 0.14], [0.72, 0.26], [0.3, 0.42], [0.62, 0.46],
    [0.16, 0.62], [0.44, 0.68], [0.74, 0.62], [0.26, 0.86], [0.58, 0.86],
  ];
  const crowd = seeds.map(([fx, fy], i) => `<circle cx="${bx + fx * bw}" cy="${by + fy * bh}" r="${i % 3 === 0 ? 14 : 11}"
    fill="${CREAM}" opacity="${0.34 + (i % 4) * 0.08}"/>`).join('');

  const fromX = bx + 0.62 * bw, fromY = by + 0.46 * bh;
  const branches = [-104, -4, 96].map((dy) => `
    <path d="M ${right + 78} ${escapeY} C ${right + 132} ${escapeY}, ${right + 138} ${escapeY + dy}, ${right + 198} ${escapeY + dy}"
      fill="none" stroke="${YELLOW}" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
    <circle cx="${right + 198}" cy="${escapeY + dy}" r="14" fill="${YELLOW}"/>`).join('');

  return stage(`
    <ellipse cx="${right + 40}" cy="${escapeY}" rx="150" ry="150" fill="url(#glow)"/>
    ${wall}${crowd}
    <path d="M ${fromX} ${fromY} C ${right - 30} ${fromY}, ${right - 6} ${escapeY}, ${right + 78} ${escapeY}"
      fill="none" stroke="${YELLOW}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="${fromX}" cy="${fromY}" r="16" fill="${YELLOW}"/>
    ${branches}
  `);
}

// --------------------------------------------------------------------------

const COVERS = [
  ['prompting', prompting],
  ['first-agent', agentLoop],
  ['local-llm', localLlm],
  ['ship-code', shipCode],
  ['security', security],
  ['agent-breach', breach],
];

mkdirSync(OUT, { recursive: true });
const keepSvg = process.argv.includes('--svg');

for (const [name, draw] of COVERS) {
  const svg = draw();
  if (keepSvg) writeFileSync(join(OUT, `${name}.svg`), svg);
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 92 }).toBuffer();
  writeFileSync(join(OUT, `${name}.webp`), buf);
  console.log(`  ${name}.webp  ${(buf.length / 1024).toFixed(1)}KB`);
}
console.log(`\n${COVERS.length} covers written to public/learn/covers`);
