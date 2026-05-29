// Renders public/favicon.svg into all the raster icon sizes (free, no API).
// Run: npm run gen:icons
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'public', 'favicon.svg');
const out = (n) => join(root, 'public', n);

const sizes = [
  [16, 'favicon-16.png'],
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
];

for (const [size, name] of sizes) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out(name));
  console.log('wrote', name);
}
console.log('done');
