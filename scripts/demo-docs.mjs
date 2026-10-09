// Makes fictional demo documents for screenshot capture (never real data): photo-like "captures" of an invoice and
// a letter — greyish paper, a hand shadow, slight tilt, on a dark desk — so the app's detection and clean-up have
// something realistic to work on. Output: screenshots-raw/demo/ (gitignored).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'screenshots-raw', 'demo');
await mkdir(out, { recursive: true });

const W = 1240, H = 1754; // A4 at 150 dpi
const font = 'Segoe UI, Arial, sans-serif';
const t = (x, y, s, text, w = 400, fill = '#1d1d1d') =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${s}" font-weight="${w}" fill="${fill}">${text}</text>`;

function invoice() {
  const rows = [
    ['Interior design consultation', '2', '£85.00', '£170.00'],
    ['Room layout plan – living area', '1', '£240.00', '£240.00'],
    ['Colour and materials board', '1', '£120.00', '£120.00'],
    ['Site visit and measurements', '3', '£45.00', '£135.00'],
    ['Lighting specification', '1', '£95.00', '£95.00'],
  ];
  let y = 760, body = '';
  for (const [d, q, u, a] of rows) {
    body += t(110, y, 30, d) + t(760, y, 30, q) + t(880, y, 30, u) + t(1050, y, 30, a);
    body += `<rect x="100" y="${y + 22}" width="1040" height="1.5" fill="#bbb"/>`;
    y += 72;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>
    ${t(100, 170, 64, 'Harbour &amp; Pine Interiors', 700, '#12423d')}
    ${t(100, 222, 28, '14 Quayside Walk · Example Town · EX1 2AB', 400, '#555')}
    ${t(900, 170, 56, 'INVOICE', 800, '#12423d')}
    ${t(100, 360, 30, 'Billed to', 700)}${t(100, 404, 30, 'Sample Customer Ltd')}${t(100, 446, 30, '1 Demo Street, Example City')}
    ${t(760, 360, 30, 'Invoice no.', 700)}${t(960, 360, 30, 'HP-2026-0417')}
    ${t(760, 404, 30, 'Date', 700)}${t(960, 404, 30, '12 Sep 2026')}
    ${t(760, 446, 30, 'Due', 700)}${t(960, 446, 30, '12 Oct 2026')}
    <rect x="100" y="640" width="1040" height="64" fill="#e8f1ef"/>
    ${t(110, 684, 28, 'Description', 700)}${t(760, 684, 28, 'Qty', 700)}${t(880, 684, 28, 'Unit', 700)}${t(1050, 684, 28, 'Amount', 700)}
    ${body}
    ${t(760, 1180, 30, 'Subtotal')}${t(1050, 1180, 30, '£760.00')}
    ${t(760, 1226, 30, 'VAT 20%')}${t(1050, 1226, 30, '£152.00')}
    <rect x="750" y="1250" width="390" height="3" fill="#12423d"/>
    ${t(760, 1302, 36, 'Total', 800)}${t(1030, 1302, 36, '£912.00', 800)}
    ${t(100, 1480, 28, 'Payment within 30 days. Thank you for your business.', 400, '#555')}
    ${t(100, 1530, 28, 'This is a fictional sample document for demonstration only.', 400, '#888')}
  </svg>`;
}

function letter() {
  const para = [
    'Thank you for visiting our studio last week. As promised, we have',
    'prepared a first proposal for the refurbishment of your reading room.',
    '',
    'The plan keeps the existing bookshelves and adds warm, indirect',
    'lighting along the ceiling. We suggest a soft sage green for the walls',
    'and oak flooring to match the window frames.',
    '',
    'Please review the attached drawings. We would be happy to discuss any',
    'changes at a time that suits you. The quotation remains valid for',
    'thirty days from the date of this letter.',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>
    ${t(100, 170, 56, 'Harbour &amp; Pine Interiors', 700, '#12423d')}
    ${t(100, 216, 26, '14 Quayside Walk · Example Town · EX1 2AB', 400, '#555')}
    ${t(100, 360, 30, '18 September 2026')}
    ${t(100, 460, 30, 'Dear Sample Customer,')}
    ${para.map((line, i) => t(100, 540 + i * 50, 30, line)).join('')}
    ${t(100, 1140, 30, 'Kind regards,')}
    ${t(100, 1320, 30, 'The Harbour &amp; Pine design team')}
    ${t(100, 1560, 26, 'This is a fictional sample document for demonstration only.', 400, '#888')}
  </svg>`;
}

// A phone photo of the page: grey-warm paper, a soft hand shadow from one corner, tilted, on a dark desk.
async function photo(svg, name, angle) {
  const page = await sharp(Buffer.from(svg)).png().toBuffer();
  const tint = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="s" cx="100%" cy="100%" r="90%"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".55" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="#b9ad96" opacity=".38"/>
    <rect width="${W}" height="${H}" fill="url(#s)"/></svg>`);
  const aged = await sharp(page).composite([{ input: tint, blend: 'multiply' }]).modulate({ brightness: 0.95 }).blur(0.6).png().toBuffer();
  const tilted = await sharp(aged).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(tilted).metadata();
  const cw = Math.round(meta.width * 1.22), ch = Math.round(meta.height * 1.16);
  const desk = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
    <defs><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2f27"/><stop offset="1" stop-color="#241c17"/></linearGradient></defs>
    <rect width="${cw}" height="${ch}" fill="url(#d)"/></svg>`);
  await sharp(desk)
    .composite([{ input: tilted, left: Math.round((cw - meta.width) / 2), top: Math.round((ch - meta.height) / 2) }])
    .jpeg({ quality: 88 })
    .toFile(path.join(out, name));
}

await photo(invoice(), 'demo-invoice.jpg', -4);
await photo(letter(), 'demo-letter.jpg', 3);
// Flat A4 pages for printing, so live-camera and creased-paper shots also use fictional content.
await sharp(Buffer.from(invoice())).png().toFile(path.join(out, 'print-invoice.png'));
await sharp(Buffer.from(letter())).png().toFile(path.join(out, 'print-letter.png'));
console.log('demo documents written to', out);
