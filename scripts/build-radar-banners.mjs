// Crops the four brand banner artworks into the wide strips that sit above each
// Radar section, and writes them to public/radar/sections/<category>.webp.
//
//   node scripts/build-radar-banners.mjs
//
// The sources live in assets/ rather than public/ for two reasons. They are
// 3.4MB of PNG that nothing on the site loads, and everything under public/ is
// copied verbatim into dist/. They are also named banner-0N.png rather than
// "Banner N.png" because .gitignore blocks `* 2.*` and `* 3.*` (the guard
// against sync-client duplicates), which silently made two of the four
// untrackable under their original names.
//
// The sources are text-backdrop frames: a decorated border of
// green waves and yellow suns around an empty cream centre. They are not banner
// art, so a naive centre crop returns a blank cream strip. Each entry below
// names the band that actually carries shapes, picked by eye from a contact
// sheet of top / middle / bottom crops.
//
// The band height is derived from the output ratio rather than typed, so the
// crop is a uniform scale with no stretch whatever the source size is. `band`
// is a keyword for the frames and a pixel offset where the shape had to be
// framed by hand: the sun in banner-03 is taller than any band that fits, so a
// keyword crop slices it into a flat slab. 360 catches the whole dome rising
// off the bottom edge with the rays still around it.
//
// These strips are decorative and render with alt="" in Radar.jsx. If one ever
// becomes load-bearing it needs real alt text, and at that point it should be
// inline SVG rather than a generated raster.

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/radar/sections';
const W = 2000;
const H = 280;

// category → source file + which horizontal band of it to take.
// Assignments are by silhouette, since none of the four depicts anything
// category-specific: agents gets the one continuous wave, models gets the
// sunrise (the engine everything else rents), build gets the two banks with a
// span between them, work gets the calmest.
const STRIPS = [
  { key: 'agents', src: 'assets/radar-banners/banner-01.png', band: 'bottom' },
  { key: 'models', src: 'assets/radar-banners/banner-03.png', band: 360      },
  { key: 'build',  src: 'assets/radar-banners/banner-02.png', band: 'bottom' },
  { key: 'work',   src: 'assets/radar-banners/banner-04.png', band: 'top'    },
];

mkdirSync(OUT, { recursive: true });

for (const { key, src, band } of STRIPS) {
  const { width, height } = await sharp(src).metadata();
  const bandH = Math.round(width / (W / H));
  const top = typeof band === 'number' ? band
    : band === 'top' ? 0
    : band === 'bottom' ? height - bandH
    : Math.round((height - bandH) / 2);

  const file = `${OUT}/${key}.webp`;
  await sharp(src)
    .extract({ left: 0, top, width, height: bandH })
    .resize(W, H, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(file);

  const scale = (W / width).toFixed(2);
  console.log(`${key.padEnd(7)} ${src.split('/').pop().padEnd(14)} ${String(band).padEnd(6)} y=${top} ${width}x${bandH} → ${W}x${H} (${scale}x)`);
}
