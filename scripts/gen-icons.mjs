// Renders public/favicon.svg into all the raster icon sizes, and builds the OG
// image from the AI Sundays wordmark (free, no API).
// Run: npm run gen:icons
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'public', 'favicon.svg');
const out = (n) => join(root, 'public', n);

// Brand palette, matching public/brand/logo.svg.
const BRAND_CREAM = { r: 0xf7, g: 0xf3, b: 0xe8, alpha: 1 };
const BRAND_GREEN = { r: 0x12, g: 0x4a, b: 0x30, alpha: 1 };

// One source for every size. The rounded-tile mark stays legible at 16px, so the
// separate simplified 16px variant is no longer needed.
const sizes = [
  [16, 'favicon-16.png'],
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
];

for (const [size, name] of sizes) {
  let img = sharp(svg, { density: 512 }).resize(size, size);
  // iOS applies its own mask and composites the icon itself, so a transparent
  // corner shows up as a dark notch on the home screen. Flatten this one onto
  // the tile colour: the corners fill with the same green the tile already is,
  // which reads as a full-bleed square and lets iOS round it.
  if (name === 'apple-touch-icon.png') img = img.flatten({ background: BRAND_GREEN });
  await img.png().toFile(out(name));
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
