// Verifies dist/: every local href/src/srcset resolves to a file, every page has one <h1>, a title, a meta
// description and a lang, every <img> has alt text, and no unfinished-owner-input marker is published without being
// listed in site.config.json "knownPlaceholders". Exit code 1 on any problem.
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

async function exists(p) {
  try { const s = await stat(p); return s.isFile() || (s.isDirectory() && (await stat(path.join(p, 'index.html'))).isFile()); }
  catch { return false; }
}

const problems = [];
const files = await walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const css = files.filter((f) => f.endsWith('.css'));

for (const page of pages) {
  const rel = path.relative(dist, page).replaceAll('\\', '/');
  const html = await readFile(page, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) problems.push(`${rel}: ${h1} <h1> elements`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: no <title>`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(`${rel}: no meta description`);
  if (!/<html lang="/.test(html)) problems.push(`${rel}: no lang`);
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\balt="/.test(img)) problems.push(`${rel}: <img> without alt: ${img.slice(0, 80)}`);
  }
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/\bsrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])));
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    const base = new URL(config.siteUrl).pathname;
    const target = clean.startsWith('/')
      ? (clean.startsWith(base) ? path.join(dist, clean.slice(base.length)) : path.join(dist, '__outside_base__'))
      : path.resolve(path.dirname(page), clean);
    if (!await exists(target)) problems.push(`${rel}: broken link ${ref}`);
  }
  for (const marker of html.match(/\[[A-Z][A-Z0-9 /&'-]+REQUIRED\]/g) ?? []) {
    if (!(config.knownPlaceholders ?? []).includes(marker)) problems.push(`${rel}: unlisted placeholder ${marker}`);
  }
}

for (const sheet of css) {
  const text = await readFile(sheet, 'utf8');
  for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (/^(data:|https?:)/.test(m[1])) continue;
    if (!await exists(path.resolve(path.dirname(sheet), m[1]))) problems.push(`${path.relative(dist, sheet)}: broken url(${m[1]})`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`OK: ${pages.length} pages, ${files.length} files, all local links resolve.`);
