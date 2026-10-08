// Builds the static site into dist/.
//
// Every page in src/pages is an HTML fragment whose first line is a JSON comment:
//   <!--{"title":"…","description":"…","nav":"features"}-->
// The build wraps it in src/layout.html, replacing:
//   {{root}}         a relative prefix to the site root ("./", "../"), so the site works at
//                    https://<user>.github.io/nexascan-web/ and at a custom domain alike
//   {{title}} {{description}} {{canonical}} {{og_image}} {{year}}
//   {{nav:<key>}}    aria-current="page" on the active nav link
//   {{include:name}} a partial from src/partials
//   {{config:key}}   a value from site.config.json (store URL, contact email …)
//   {{gen:name}}     HTML generated from src/data/plans.json (Free/Pro facts), so no page repeats that list by hand
// Pages at src/pages/<name>/index.html become dist/<name>/index.html, so /privacy/ works directly.
import { readFile, writeFile, mkdir, readdir, cp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const plans = JSON.parse(await readFile(path.join(src, 'data', 'plans.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proTag = '<span class="tag tag-pro">Pro</span>';
const cell = (v) => (v === true ? '<span class="yes" aria-label="Included">✓</span>'
  : v === false ? '<span class="no" aria-label="Not included">–</span>' : esc(v));

// Generated sections. Each returns HTML built only from plans.json.
const generators = {
  'tool-groups': () => plans.groups.map((g) => `
        <article class="group reveal">
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.summary)}</p>
          <ul class="tool-list">
${g.tools.map((t) => `            <li><strong>${esc(t.name)}${t.tier === 'pro' ? ` ${proTag}` : ''}</strong><span>${esc(t.benefit)}${t.limit ? ` <em>Free: ${esc(t.limit)}.</em>` : ''}</span></li>`).join('\n')}
          </ul>
        </article>`).join('\n'),
  'compare-table': () => `<div class="table-wrap compare-table"><table>
          <caption class="visually-hidden">What NexaScan Free and NexaScan Pro include</caption>
          <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
          <tbody>
${plans.compare.map((r) => `            <tr><th scope="row">${esc(r.feature)}</th><td>${cell(r.free)}</td><td>${cell(r.pro)}</td></tr>`).join('\n')}
          </tbody>
        </table></div>`,
  'pro-highlights': () => plans.proHighlights.map((h) => `<li>${esc(h)}</li>`).join('\n          '),
  'free-looks': () => esc(plans.looks.free.join(', ').replace(/, ([^,]+)$/, ' and $1')),
  'price-line': () => (plans.pricing.confirmed
    ? `${esc(plans.pricing.monthly)} a month or ${esc(plans.pricing.annual)} a year in the ${esc(plans.pricing.region)}. Google Play shows the price for your country before you pay.`
    : 'Monthly or yearly subscription. Google Play shows the price for your country before you pay.'),
};

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const partials = {};
for (const file of await readdir(path.join(src, 'partials'))) {
  partials[path.basename(file, '.html')] = await readFile(path.join(src, 'partials', file), 'utf8');
}
const layout = await readFile(path.join(src, 'layout.html'), 'utf8');

function render(template, vars, depth = 0) {
  if (depth > 5) throw new Error('include nesting too deep');
  return template
    .replace(/\{\{include:([\w-]+)\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`unknown partial ${name}`);
      return render(partials[name], vars, depth + 1);
    })
    .replace(/\{\{gen:([\w-]+)\}\}/g, (_, name) => {
      if (!(name in generators)) throw new Error(`unknown generator ${name}`);
      return generators[name]();
    })
    .replace(/\{\{config:([\w.]+)\}\}/g, (_, key) => {
      const value = key.split('.').reduce((o, k) => o?.[k], config);
      if (value === undefined) throw new Error(`unknown config key ${key}`);
      return String(value);
    })
    .replace(/\{\{nav:([\w-]+)\}\}/g, (_, key) => (key === vars.nav ? 'aria-current="page"' : ''))
    .replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const pageFiles = (await walk(path.join(src, 'pages'))).filter((f) => f.endsWith('.html'));
for (const file of pageFiles) {
  const rel = path.relative(path.join(src, 'pages'), file).replaceAll('\\', '/');
  const raw = await readFile(file, 'utf8');
  const meta = raw.match(/^<!--(\{.*?\})-->/s);
  if (!meta) throw new Error(`${rel}: missing front-matter comment`);
  const front = JSON.parse(meta[1]);
  const body = raw.slice(meta[0].length);
  const depth = rel.split('/').length - 1;
  // 404.html is served by GitHub Pages at whatever path was missed, so relative links would break; it uses the
  // site's absolute base path instead.
  const rootPrefix = rel === '404.html' ? new URL(config.siteUrl).pathname : depth === 0 ? './' : '../'.repeat(depth);
  const pagePath = rel === 'index.html' ? '' : rel.replace(/index\.html$/, '').replace(/\.html$/, '.html');
  const vars = {
    root: rootPrefix,
    title: front.title,
    description: front.description,
    nav: front.nav ?? '',
    bodyClass: front.bodyClass ?? '',
    canonical: config.siteUrl.replace(/\/$/, '') + '/' + pagePath,
    og_image: config.siteUrl.replace(/\/$/, '') + '/assets/brand/og-image.png',
    year: String(new Date().getFullYear()),
    // The one switch for launch day: set storeUrl in site.config.json and every download button goes live.
    store_href: config.storeUrl || `${rootPrefix}#download`,
    store_label: config.storeUrl ? 'Get it on Google Play' : 'Coming soon on Google Play',
    store_rel: config.storeUrl ? 'rel="noopener"' : '',
    download_heading: config.storeUrl ? 'Get NexaScan on Google Play' : 'NexaScan is coming to Google Play',
    download_text: config.storeUrl
      ? 'Install it on your Android phone and scan your first document in seconds.'
      : 'Android first. When the listing goes live, this button will take you straight to it.',
  };
  const html = render(layout.replace('{{content}}', body), vars);
  if (/\{\{[\w:.-]+\}\}/.test(html)) throw new Error(`${rel}: unresolved placeholder ${html.match(/\{\{[\w:.-]+\}\}/)[0]}`);
  const out = path.join(dist, rel);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);
}

// Static assets, copied as they are.
await cp(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
for (const file of ['robots.txt', '.nojekyll']) {
  try { await stat(path.join(root, 'public', file)); await cp(path.join(root, 'public', file), path.join(dist, file)); } catch { /* optional */ }
}

// sitemap.xml from the built pages (404 excluded).
const urls = pageFiles
  .map((f) => path.relative(path.join(src, 'pages'), f).replaceAll('\\', '/'))
  .filter((rel) => rel !== '404.html')
  .map((rel) => config.siteUrl.replace(/\/$/, '') + '/' + (rel === 'index.html' ? '' : rel.replace(/index\.html$/, '')));
await writeFile(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${pageFiles.length} pages into dist/`);
