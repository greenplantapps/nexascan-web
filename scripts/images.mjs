// Image pipeline (run locally; outputs are committed so the deploy needs no native dependencies).
//  1. Brand: favicon-32/48.png, apple-touch-icon.png and the 1200x630 og-image.png, all from the app's own logo
//     (assets/brand/nexascan-logo.png, copied from the app repo's Resources/Branding/<brand>/app_logo.png).
//  2. Screenshots: every PNG in screenshots-raw/ (private, gitignored) → assets/screenshots/<name>.webp at 540 px
//     wide (2x for the ~270 px phone frames). Only captures that were reviewed for personal data belong in there.
//     Every capture loses the phone's status bar and gesture bar (Pixel 9: top 173 px, bottom 63 px), so no clock,
//     notification or signal icon is ever published. Pairs named <name>.crop.json ({"left","top","width","height"}
//     in source pixels) are cropped that way instead (the before/after page crops).
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'assets', 'brand');
const logo = await readFile(path.join(brand, 'nexascan-logo.png'));

await sharp(logo).resize(32, 32).png().toFile(path.join(brand, 'favicon-32.png'));
await sharp(logo).resize(48, 48).png().toFile(path.join(brand, 'favicon-48.png'));
await sharp(logo).resize(180, 180).flatten({ background: '#011F36' }).png().toFile(path.join(brand, 'apple-touch-icon.png'));

// Social share card: the logo, the name and the descriptor on the logo's navy, with its teal band. No other claims.
const logoData = `data:image/png;base64,${logo.toString('base64')}`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="85%" cy="0%" r="110%"><stop offset="0" stop-color="#0B3D5E"/><stop offset=".5" stop-color="#011F36"/><stop offset="1" stop-color="#01121F"/></radialGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1DACA0"/><stop offset="1" stop-color="#06877F"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="0" y="560" width="1200" height="70" fill="url(#b)"/>
  <image href="${logoData}" x="96" y="150" width="250" height="250"/>
  <text x="400" y="272" font-family="Segoe UI, Arial, sans-serif" font-size="104" font-weight="800" fill="#FFFFFF" letter-spacing="-3">Nexa<tspan fill="#3FD6C4">Scan</tspan></text>
  <text x="406" y="342" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="600" fill="#BFD3E2">AI Scanner &amp; PDF Tools</text>
  <text x="96" y="492" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="500" fill="#A9C0D0">Scan · Clean up · Read · Convert · Protect — on your phone</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(path.join(brand, 'og-image.png'));
console.log('brand assets written');

const rawDir = path.join(root, 'screenshots-raw');
const outDir = path.join(root, 'assets', 'screenshots');
await mkdir(outDir, { recursive: true });
let count = 0;
for (const file of (await readdir(rawDir).catch(() => [])).filter((f) => f.toLowerCase().endsWith('.png'))) {
  const name = path.basename(file, '.png');
  let img = sharp(path.join(rawDir, file));
  const crop = await readFile(path.join(rawDir, `${name}.crop.json`), 'utf8').then(JSON.parse).catch(() => null);
  const meta = await sharp(path.join(rawDir, file)).metadata();
  img = img.extract(crop ?? { left: 0, top: 173, width: meta.width, height: meta.height - 173 - 63 });
  const width = name.startsWith('enhance-') ? 900 : 540;
  await img.resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(path.join(outDir, `${name}.webp`));
  count++;
}
console.log(`${count} screenshot(s) written to assets/screenshots`);
