// Renders public/favicon.svg into all the raster icon sizes, and builds the OG
// image from the AI Sundays wordmark (free, no API).
// Run: npm run gen:icons
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'public', 'favicon.svg');
// The brand ships a 16px-specific mark: the rays are dropped and the shapes
// thickened, because the full icon's rays disappear at tab size.
const svg16 = join(root, 'public', 'brand', 'icon-16.svg');
const out = (n) => join(root, 'public', n);

// Brand palette, matching public/brand/logo.svg.
const BRAND_CREAM = { r: 0xf7, g: 0xf3, b: 0xe8, alpha: 1 };

const sizes = [
  [16, 'favicon-16.png', svg16],
  [32, 'favicon-32.png', svg16],
  [180, 'apple-touch-icon.png', svg],
  [192, 'icon-192.png', svg],
  [512, 'icon-512.png', svg],
];

for (const [size, name, source] of sizes) {
  await sharp(source, { density: 512 }).resize(size, size).png().toFile(out(name));
  console.log('wrote', name);
}

// Social / OG image (1200x630): the wordmark on a warm ground.
//
// Uses the STANDARD lockup, not the inverted one. The rising sun sits outside
// the blob and takes the letter colour, so on a green ground the inverted mark's
// green sun disappears into the background and the logo loses its one
// distinguishing element.
const lockup = join(root, 'public', 'brand', 'logo.svg');
if (existsSync(lockup)) {
  const W = 1200, H = 630, MARK = 880; // the mark occupies ~73% of the width
  const mark = await sharp(lockup, { density: 400 }).resize({ width: MARK }).png().toBuffer();
  const { height: markH } = await sharp(mark).metadata();
  await sharp({ create: { width: W, height: H, channels: 4, background: BRAND_CREAM } })
    .composite([{ input: mark, left: Math.round((W - MARK) / 2), top: Math.round((H - markH) / 2) }])
    .png()
    .toFile(join(root, 'public', 'brand', 'og.png'));
  console.log('wrote brand/og.png');
}
console.log('done');
