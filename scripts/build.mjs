// Builds the static site into dist/.
//
// Every page in src/pages is an HTML fragment whose first line is a JSON comment:
//   <!--{"title":"…","description":"…","nav":"features"}-->       add "index": false to keep a page out of search
// The build wraps it in src/layout.html, replacing:
//   {{root}}         a relative prefix to the site root ("./", "../"), so the site works at
//                    https://<user>.github.io/nexascan-web/ and at a custom domain alike
//   {{seo_head}}     canonical + og:url (indexable pages) or robots noindex; JSON-LD and the Search Console
//                    verification tag on the home page
//   {{title}} {{description}} {{og_image}} {{year}}
//   {{nav:<key>}}    aria-current="page" on the active nav link
//   {{include:name}} a partial from src/partials
//   {{config:key}}   a value from site.config.json (store URL, developer name …)
//   {{email:key}}    a contact address from site.config.json as a mailto link (or its "[… REQUIRED]" marker)
//   {{gen:name}}     HTML generated from src/data/plans.json (Free/Pro facts), so no page repeats that list by hand
// Pages at src/pages/<name>/index.html become dist/<name>/index.html, so /privacy/ works directly.
import { readFile, writeFile, mkdir, readdir, cp, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const plans = JSON.parse(await readFile(path.join(src, 'data', 'plans.json'), 'utf8'));
const siteBase = config.siteUrl.replace(/\/$/, '');
const pages = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proTag = '<span class="tag tag-pro">Pro</span>';
const cell = (v) => (v === true ? '<span class="yes" aria-label="Included">✓</span>'
  : v === false ? '<span class="no" aria-label="Not included">–</span>' : esc(v));

// Generated sections. Each returns HTML built only from plans.json.
const generators = {
  'tool-groups': () => plans.groups.map((g) => `
        <article class="group reveal">
          <h2 class="h3">${esc(g.name)}</h2>
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

// Site identity for Google (home page only): the site name and who publishes it. Only facts that are visible on the
// site; no ratings, no logo claim for the organisation (the NexaScan logo is the product's, not the company's).
function jsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteBase}/#website`, name: config.appName, url: config.siteUrl, inLanguage: 'en-GB',
        publisher: { '@id': `${siteBase}/#organization` } },
      { '@type': 'Organization', '@id': `${siteBase}/#organization`, name: config.developer, url: config.siteUrl },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// Download buttons, from site.config.json. Three states:
//   storeUrl (the public listing)  the official Google Play badge everywhere (Google's badge guidelines need a real
//                                  public listing to link to)
//   testUrl (a testing opt-in)     "Install the test version", with a note that it is for invited testers: an
//                                  internal-test link works only for Google accounts added as testers
//   neither                        "Coming to Google Play", linking to the download section
function downloadVars(rootPrefix) {
  if (config.storeUrl) {
    const href = esc(config.storeUrl);
    return {
      store_href: href, store_label: 'Get it on Google Play', store_rel: 'rel="noopener"', store_note: '',
      store_cta: `<a class="store-badge" href="${href}" rel="noopener"><img src="${rootPrefix}assets/brand/google-play-badge.png" alt="Get it on Google Play" width="646" height="250"></a>`,
      download_heading: 'Get NexaScan on Google Play',
      download_text: 'Free to download for Android phones. Scan your first document in seconds.',
    };
  }
  if (config.testUrl) {
    const href = esc(config.testUrl);
    return {
      store_href: href, store_label: 'Install the test version', store_rel: 'rel="noopener"',
      store_cta: `<a class="button" href="${href}" rel="noopener">Install the test version</a>`,
      store_note: '<p class="store-note">Test version on Google Play, for invited testers.</p>',
      download_heading: 'Try NexaScan now',
      download_text: 'NexaScan is being tested on Google Play. Invited testers can install the test version with this link.',
    };
  }
  return {
    store_href: `${rootPrefix}#download`, store_label: 'Coming to Google Play', store_rel: '', store_note: '',
    store_cta: `<a class="button" href="${rootPrefix}#download">Coming to Google Play</a>`,
    download_heading: 'NexaScan is coming to Google Play',
    download_text: 'For Android phones. When the Google Play listing opens, this button will take you straight to it.',
  };
}

// The sitemap's lastmod is the date of the last commit that touched a page's own content. Without full git history
// (no git, or a shallow CI clone) it is left out rather than guessed: Google ignores lastmod it can't trust.
const git = process.env.GIT || 'git';
const gitHistory = (() => {
  try { return execFileSync(git, ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim() === 'false'; }
  catch { return false; }
})();
function lastModified(files) {
  if (!gitHistory) return '';
  try {
    return execFileSync(git, ['log', '-1', '--format=%cs', '--', ...files.map((f) => path.relative(root, f))],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch { return ''; }
}

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
    .replace(/\{\{email:(\w+)\}\}/g, (_, key) => {
      // A contact address from site.config.json: a mailto link once it is filled in, the highlighted owner-input
      // marker while it still reads "[… REQUIRED]".
      const value = config[key];
      if (value === undefined) throw new Error(`unknown config key ${key}`);
      return /REQUIRED\]$/.test(value) ? `<span class="placeholder">${esc(value)}</span>` : `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
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
  const canonical = siteBase + '/' + pagePath;
  // Index control lives in the front matter: "index": false gives the page a robots noindex and keeps it out of the
  // sitemap. The 404 page is never indexable. A noindexed page gets no canonical (it has no URL of its own to claim).
  const indexable = rel !== '404.html' && front.index !== false;
  pages.push({ rel, file, canonical, indexable, body });
  const head = [
    indexable ? `<link rel="canonical" href="${canonical}">` : '<meta name="robots" content="noindex">',
    indexable ? `<meta property="og:url" content="${canonical}">` : '',
    rel === 'index.html' && config.seo?.googleSiteVerification
      ? `<meta name="google-site-verification" content="${esc(config.seo.googleSiteVerification)}">` : '',
    rel === 'index.html' ? jsonLd() : '',
  ].filter(Boolean).join('\n  ');
  const vars = {
    root: rootPrefix,
    title: esc(front.title),
    description: esc(front.description),
    nav: front.nav ?? '',
    bodyClass: front.bodyClass ?? '',
    seo_head: head,
    og_image: siteBase + '/assets/brand/og-image.png',
    year: String(new Date().getFullYear()),
    ...downloadVars(rootPrefix),
  };
  const html = render(layout.replace('{{content}}', body), vars);
  if (/\{\{[\w:.-]+\}\}/.test(html)) throw new Error(`${rel}: unresolved placeholder ${html.match(/\{\{[\w:.-]+\}\}/)[0]}`);
  const out = path.join(dist, rel);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);
}

// Static assets, copied as they are.
await cp(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
try { await stat(path.join(root, 'public', '.nojekyll')); await cp(path.join(root, 'public', '.nojekyll'), path.join(dist, '.nojekyll')); } catch { /* optional */ }

// sitemap.xml: the canonical URL of every indexable page, nothing else.
const entries = pages.filter((p) => p.indexable).sort((a, b) => a.canonical.length - b.canonical.length || a.canonical.localeCompare(b.canonical)).map((p) => {
  const lastmod = lastModified(p.body.includes('{{gen:') ? [p.file, path.join(src, 'data', 'plans.json')] : [p.file]);
  return `  <url><loc>${p.canonical}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
});
await writeFile(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);

// robots.txt only counts at the root of a host. On a project site (https://<owner>.github.io/<repo>/) a file here
// would be ignored, so none is written; the sitemap is submitted in Search Console instead. With a custom domain
// (siteUrl at a host root) the build writes one that allows everything and names the sitemap.
if (new URL(config.siteUrl).pathname === '/') {
  await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteBase}/sitemap.xml\n`);
}

console.log(`Built ${pageFiles.length} pages into dist/ (${entries.length} in sitemap${gitHistory ? '' : ', no lastmod: full git history unavailable'})`);
