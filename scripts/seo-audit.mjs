// Technical SEO audit of the built site (dist/). Run `npm run build` first.
//
//   npm run seo            checks dist/ only (no network); this is the CI gate
//   npm run seo -- --live  also fetches the deployed site: real status codes, redirects, the 404, host-root robots.txt
//
// Each URL is described by separate attributes rather than one category, because they are independent:
// httpStatus, crawl (robots.txt), index (robots meta), auth (always "none" on this static site), canonical, inSitemap.
// Findings have three severities. ERROR fails the run (and the deploy); WARNING and RECOMMENDATION never do.
// RECOMMENDATIONs are content and owner suggestions, kept apart from technical problems.
// The route inventory and a report are written to .seo-reports/ (gitignored).
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const live = process.argv.includes('--live');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const site = new URL(config.siteUrl);
const siteBase = config.siteUrl.replace(/\/$/, '');
const findings = [];
const add = (severity, where, message, fix = '', autoFixable = false) => findings.push({ severity, where, message, fix, autoFixable });
const ERROR = 'ERROR', WARNING = 'WARNING', RECOMMENDATION = 'RECOMMENDATION';

// Structured data this site may publish. Ratings, reviews and FAQPage are refused: NexaScan has no genuine ratings,
// and FAQ rich results are no longer shown (see .claude/skills/nexascan-seo/references/google-search-rules.md).
const allowedTypes = new Set(['WebSite', 'Organization']);
const refusedTypes = new Set(['AggregateRating', 'Review', 'FAQPage', 'SoftwareApplication', 'MobileApplication']);
const stagingHost = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b|staging|preview|file:)/i;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full)); else out.push(full);
  }
  return out;
}
const attr = (html, re) => (html.match(re) ?? [])[1];
const decode = (s) => s?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

try { await stat(path.join(dist, 'index.html')); } catch { console.error('dist/ is missing: run npm run build first.'); process.exit(1); }

// ── Source intent: which pages are meant to be indexable (front matter "index": false opts out) ─────────────
const intended = new Map();
for (const file of (await walk(path.join(root, 'src', 'pages'))).filter((f) => f.endsWith('.html'))) {
  const rel = path.relative(path.join(root, 'src', 'pages'), file).replaceAll('\\', '/');
  const front = JSON.parse(((await readFile(file, 'utf8')).match(/^<!--(\{.*?\})-->/s) ?? [, '{}'])[1]);
  intended.set(rel, rel !== '404.html' && front.index !== false);
}

// ── Sitemap ──────────────────────────────────────────────────────────────────────────────────────────────────
const sitemap = new Map();
try {
  const xml = (await readFile(path.join(dist, 'sitemap.xml'), 'utf8')).replace(/^﻿/, '');
  if (!/^<\?xml[^>]*\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(xml)) {
    add(ERROR, 'sitemap.xml', 'Not a valid sitemap urlset document.', 'Regenerate it with npm run build.', true);
  }
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?\s*<\/url>/g)) {
    const [, loc, lastmod] = m;
    if (sitemap.has(loc)) add(ERROR, 'sitemap.xml', `Duplicate URL ${loc}.`, 'Each canonical URL appears once.', true);
    sitemap.set(loc, lastmod ?? '');
    if (!loc.startsWith(siteBase + '/') || !loc.startsWith('https://')) add(ERROR, 'sitemap.xml', `${loc} is not an https URL under ${config.siteUrl}.`, 'Check siteUrl in site.config.json.');
    if (stagingHost.test(loc)) add(ERROR, 'sitemap.xml', `${loc} points at a local or staging host.`, 'Use the production siteUrl.');
    if (lastmod && (!/^\d{4}-\d{2}-\d{2}/.test(lastmod) || new Date(lastmod) > new Date(Date.now() + 864e5))) {
      add(ERROR, 'sitemap.xml', `${loc} has an invalid or future lastmod "${lastmod}".`, 'lastmod must be the real last change date.');
    }
  }
  if (sitemap.size && [...sitemap.values()].every((v) => !v)) {
    add(WARNING, 'sitemap.xml', 'No lastmod values (built without full git history).', 'CI builds with fetch-depth: 0; locally set GIT to git.exe if git is not on PATH.', true);
  }
} catch { add(ERROR, 'sitemap.xml', 'Missing.', 'npm run build writes it.', true); }

// ── robots.txt: only meaningful at a host root ───────────────────────────────────────────────────────────────
let robotsRules = null; // null: no robots.txt governs this site from here
const atHostRoot = site.pathname === '/';
try {
  const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
  if (!atHostRoot) {
    add(WARNING, 'robots.txt', `robots.txt is published under ${site.pathname}, where crawlers ignore it.`, 'Remove it, or move the site to a custom domain.', true);
  } else {
    robotsRules = parseRobots(robots);
    if (!/^Sitemap:\s*https:\/\//mi.test(robots)) add(WARNING, 'robots.txt', 'No absolute Sitemap: line.', 'Add Sitemap: <siteUrl>sitemap.xml.', true);
  }
} catch {
  if (atHostRoot) add(WARNING, 'robots.txt', 'No robots.txt at the host root (Google then crawls everything).', 'The build writes one when siteUrl is a host root.', true);
}
function parseRobots(text) {
  const rules = []; let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...v] = line.split(':'); const key = k.trim().toLowerCase(); const val = v.join(':').trim();
    if (key === 'user-agent') applies = val === '*' || /googlebot/i.test(val);
    else if (applies && (key === 'allow' || key === 'disallow')) rules.push({ allow: key === 'allow', path: val });
  }
  return rules;
}
function crawlAllowed(urlPath, rules) {
  if (!rules) return true;
  let best = { len: -1, allow: true };
  for (const r of rules) if (r.path && urlPath.startsWith(r.path) && r.path.length > best.len) best = { len: r.path.length, allow: r.allow };
  return best.allow;
}

// ── Pages ────────────────────────────────────────────────────────────────────────────────────────────────────
const files = await walk(dist);
const pages = [];
const linkTargets = new Set();
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const rel = path.relative(dist, file).replaceAll('\\', '/');
  const html = await readFile(file, 'utf8');
  const urlPath = site.pathname + rel.replace(/index\.html$/, '');
  const url = rel === '404.html' ? null : site.origin + urlPath;
  const robotsMeta = (attr(html, /<meta name="robots" content="([^"]+)"/) ?? '').toLowerCase();
  const page = {
    url, file: rel, route: rel === '404.html' ? '(missing pages)' : urlPath,
    title: decode(attr(html, /<title>([^<]*)<\/title>/)), description: decode(attr(html, /<meta name="description" content="([^"]*)"/)),
    canonical: attr(html, /<link rel="canonical" href="([^"]+)"/) ?? null, ogUrl: attr(html, /<meta property="og:url" content="([^"]+)"/) ?? null,
    index: robotsMeta.includes('noindex') ? 'noindex' : 'index', crawl: crawlAllowed(urlPath, robotsRules) ? 'allowed' : 'disallowed',
    auth: 'none', httpStatus: rel === '404.html' ? 404 : 200, inSitemap: url ? sitemap.has(url) : false, lastmod: url ? sitemap.get(url) ?? '' : '',
    structuredData: [], intendedIndexable: intended.get(rel) ?? true, words: 0,
  };
  pages.push(page);
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]*)(?:#[^"]*)?"/g)) {
    const href = m[1]; if (!href || /^(https?:|mailto:|tel:)/.test(href)) continue;
    const abs = new URL(href, site.origin + (rel === '404.html' ? site.pathname : urlPath)).pathname;
    linkTargets.add(abs.endsWith('/') ? abs : abs + '/');
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of data['@graph'] ?? [data]) {
        page.structuredData.push(node['@type']);
        if (refusedTypes.has(node['@type'])) add(ERROR, rel, `Structured data type ${node['@type']} is not allowed on this site.`, 'Remove it; see the site policy.');
        else if (!allowedTypes.has(node['@type'])) add(WARNING, rel, `Unreviewed structured data type ${node['@type']}.`, 'Check it against current Google docs, then add it to allowedTypes.');
        if (node.url && !String(node.url).startsWith(siteBase)) add(ERROR, rel, `JSON-LD url ${node.url} is not under siteUrl.`, 'Use config.siteUrl.');
        if (JSON.stringify(node).match(/aggregateRating|"review"/i)) add(ERROR, rel, 'JSON-LD contains ratings or reviews.', 'Only genuine, visible ratings may be marked up.');
      }
    } catch { add(ERROR, rel, 'Invalid JSON-LD.', 'Fix the JSON in scripts/build.mjs jsonLd().'); }
  }
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/g, ' ').replace(/<[^>]+>/g, ' ');
  page.words = (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;

  // Index control and canonicals.
  if (page.intendedIndexable && page.index === 'noindex') add(ERROR, rel, 'Public page is noindexed.', 'Remove "index": false from its front matter, or check the layout.', true);
  if (!page.intendedIndexable && page.index !== 'noindex') add(ERROR, rel, 'Page marked "index": false has no robots noindex.', 'Rebuild; the layout adds it.', true);
  if (page.index === 'noindex' && page.crawl === 'disallowed') add(ERROR, rel, 'noindex page is blocked by robots.txt, so Google can never see the noindex.', 'Allow crawling of noindexed pages.');
  if (page.intendedIndexable && page.crawl === 'disallowed') add(ERROR, rel, 'Public page is blocked by robots.txt.', 'Fix the Disallow rules.');
  if (page.index === 'index') {
    if (!page.canonical) add(ERROR, rel, 'No canonical link.', 'The layout adds one for indexable pages.', true);
    else {
      if (page.canonical !== url) add(ERROR, rel, `Canonical ${page.canonical} is not this page's URL ${url}.`, 'Canonicals are self-referencing, https, with a trailing slash.');
      if (stagingHost.test(page.canonical) || /[?#]/.test(page.canonical)) add(ERROR, rel, `Canonical ${page.canonical} uses a local/staging host or a query/fragment.`, 'Use the production URL.');
    }
    if (page.ogUrl && page.ogUrl !== page.canonical) add(WARNING, rel, 'og:url differs from the canonical.', 'Keep them identical.', true);
    if (!page.inSitemap) add(ERROR, rel, 'Indexable page is missing from sitemap.xml.', 'Rebuild.', true);
  } else if (page.canonical) add(WARNING, rel, 'noindex page declares a canonical.', 'Drop it; a noindex page has no URL to claim.', true);
  if (page.ogUrl && stagingHost.test(page.ogUrl)) add(ERROR, rel, `og:url ${page.ogUrl} points at a local or staging host.`, 'Use the production siteUrl.');

  // Titles and descriptions: missing or duplicate is an error; length is only advice (Google sets no limit).
  if (!page.title) add(ERROR, rel, 'Missing <title>.', 'Set "title" in the front matter.');
  else if (page.index === 'index' && (page.title.length > 70 || page.title.length < 15)) add(WARNING, rel, `Title is ${page.title.length} characters; Google may shorten or rewrite it.`, 'Aim for a concise, page-specific title.');
  if (!page.description) add(ERROR, rel, 'Missing meta description.', 'Set "description" in the front matter.');
  else if (page.index === 'index' && (page.description.length < 70 || page.description.length > 165)) add(WARNING, rel, `Description is ${page.description.length} characters.`, 'About 70–160 characters reads well in results.');

  // Launch state and images.
  if ((config.storeUrl || config.testUrl) && /Coming (soon )?(on|to) Google Play/i.test(html)) add(ERROR, rel, 'An install link is set but the page still says "Coming to Google Play".', 'Rebuild; the build switches every CTA.');
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) if (!/\bwidth="\d+"/.test(img) || !/\bheight="\d+"/.test(img)) add(WARNING, rel, `Image without width/height (layout shift): ${img.slice(0, 70)}`, 'Add the intrinsic size.', true);
  for (const marker of new Set(html.match(/\[[A-Z][A-Z0-9 /&'-]+REQUIRED\]/g) ?? [])) add(WARNING, rel, `Owner input still missing: ${marker}.`, 'See docs/OWNER-DETAILS-NEEDED.md.');
}

// Duplicates, orphans, sitemap entries that aren't pages.
const indexable = pages.filter((p) => p.index === 'index');
for (const key of ['title', 'description']) {
  const seen = new Map();
  for (const p of indexable) { if (p[key]) seen.set(p[key], [...(seen.get(p[key]) ?? []), p.file]); }
  for (const [value, where] of seen) if (where.length > 1) add(ERROR, where.join(', '), `Duplicate ${key}: "${value}".`, `Each page needs its own ${key}.`);
}
for (const p of indexable) if (p.route !== site.pathname && !linkTargets.has(p.route)) add(WARNING, p.file, 'Orphan page: no internal link points to it.', 'Link it from the navigation or a related page.');
for (const loc of sitemap.keys()) if (!indexable.some((p) => p.url === loc)) add(ERROR, 'sitemap.xml', `${loc} is not an indexable page of this build.`, 'Rebuild; the sitemap lists indexable pages only.', true);
for (const f of files.filter((x) => /\.(png|jpe?g|webp)$/i.test(x))) {
  const size = (await stat(f)).size;
  if (size > 300 * 1024) add(WARNING, path.relative(dist, f).replaceAll('\\', '/'), `Image is ${Math.round(size / 1024)} KB.`, 'Re-encode with npm run images.');
}

// Owner and content recommendations (never failures).
if (!atHostRoot) add(RECOMMENDATION, 'site', `The site lives under ${site.pathname} on ${site.host}: Google can't show NexaScan's own site name or favicon, and robots.txt can't be used.`, 'Consider a custom domain (docs/SEO-MANUAL-STEPS.md, Step 1).');
if (!config.seo?.googleSiteVerification) add(RECOMMENDATION, 'site', 'Search Console verification tag not configured.', 'docs/SEO-MANUAL-STEPS.md, Step 4.');
if (!config.storeUrl) add(RECOMMENDATION, 'site', config.testUrl
  ? 'No public Google Play listing yet: download buttons install the test version, which works only for invited testers.'
  : 'No public Google Play listing yet: download buttons read "Coming to Google Play".', 'Set storeUrl when the listing is public.');
for (const p of indexable) if (p.words < 250) add(RECOMMENDATION, p.file, `Only about ${p.words} words of main content.`, 'Only expand it if users need more; never pad.');

// ── Live checks (optional) ───────────────────────────────────────────────────────────────────────────────────
if (live) {
  const get = async (u) => { try { const r = await fetch(u, { redirect: 'manual' }); return { status: r.status, location: r.headers.get('location') }; } catch (e) { return { status: 0, error: e.message }; } };
  for (const p of indexable) {
    const r = await get(p.url); p.httpStatus = r.status;
    if (r.status !== 200) add(r.status ? ERROR : WARNING, p.url, `Live status ${r.status || r.error}.`, 'Indexable pages must return 200.');
  }
  const missing = await get(`${siteBase}/this-page-does-not-exist-${Date.now()}/`);
  if (missing.status !== 404) add(ERROR, 'live', `A missing page returns ${missing.status}, not 404 (soft-404 risk).`, 'Serve 404.html with a 404 status.');
  const slash = indexable.find((p) => p.route !== site.pathname);
  if (slash) {
    const r = await get(slash.url.replace(/\/$/, ''));
    if (r.status !== 301 && r.status !== 308) add(WARNING, 'live', `${slash.url.replace(/\/$/, '')} returns ${r.status}, expected a permanent redirect to the trailing-slash URL.`);
  }
  const http = await get(config.siteUrl.replace(/^https:/, 'http:'));
  if (![301, 308].includes(http.status) || !String(http.location).startsWith('https://')) add(WARNING, 'live', `http:// returns ${http.status}; expected a permanent redirect to https://.`, 'Enable Enforce HTTPS in the Pages settings.');
  const robots = await get(`${site.origin}/robots.txt`);
  add(RECOMMENDATION, 'live', `Host-root robots.txt (${site.origin}/robots.txt) returns ${robots.status}${robots.status === 404 ? ': Google crawls everything' : ''}.`);
}

// ── Report ───────────────────────────────────────────────────────────────────────────────────────────────────
const count = (s) => findings.filter((f) => f.severity === s).length;
const errorsFor = (re) => findings.filter((f) => f.severity === ERROR && re.test(f.message)).length;
const line = (label, value) => `  ${label.padEnd(34)}${value}`;
const summary = [
  `NEXASCAN SEO AUDIT${live ? ' (with live checks)' : ''}`, '',
  line('Site', config.siteUrl),
  line('Routes discovered', pages.length),
  line('Indexable pages', indexable.length),
  line('Noindex pages', pages.length - indexable.length),
  line('Pages needing authentication', 0),
  line('Titles failing', errorsFor(/title/i)),
  line('Descriptions failing', errorsFor(/description/i)),
  line('Canonical problems', errorsFor(/canonical/i)),
  line('Sitemap URLs', `${sitemap.size} (${errorsFor(/sitemap/i) ? 'INVALID' : 'valid'})`),
  line('robots.txt', robotsRules ? 'present at host root' : atHostRoot ? 'missing' : 'not applicable on this host (sitemap goes to Search Console)'),
  line('Structured data errors', findings.filter((f) => f.severity === ERROR && /JSON-LD|Structured data/.test(f.message)).length),
  line('Orphan public pages', findings.filter((f) => /Orphan/.test(f.message)).length),
  '',
  line('Errors', count(ERROR)), line('Warnings', count(WARNING)), line('Recommendations', count(RECOMMENDATION)),
].join('\n');
console.log(summary);
for (const s of [ERROR, WARNING, RECOMMENDATION]) {
  const list = findings.filter((f) => f.severity === s);
  if (list.length) console.log(`\n${s}S\n` + list.map((f) => `  - [${f.where}] ${f.message}${f.fix ? `\n      fix: ${f.fix}` : ''}`).join('\n'));
}

const out = path.join(root, '.seo-reports');
await mkdir(out, { recursive: true });
const inventory = pages.map(({ url, route, file, httpStatus, crawl, index, auth, canonical, inSitemap, lastmod, title, description, structuredData, words }) =>
  ({ url, route, file, httpStatus, crawl, index, auth, canonical, inSitemap, lastmod, title, description, structuredData, words }));
await writeFile(path.join(out, 'routes.json'), JSON.stringify(inventory, null, 2));
await writeFile(path.join(out, 'report.json'), JSON.stringify({ generated: new Date().toISOString(), live, findings }, null, 2));
const md = [`# NexaScan SEO report`, '', `Generated ${new Date().toISOString()}${live ? ' with live checks' : ''}.`, '', '```', summary, '```', '',
  ...[ERROR, WARNING, RECOMMENDATION].flatMap((s) => {
    const list = findings.filter((f) => f.severity === s);
    return list.length ? [`## ${s[0]}${s.slice(1).toLowerCase()}s`, '', '| Where | Issue | Fix | Auto-fixable |', '|---|---|---|---|',
      ...list.map((f) => `| ${f.where} | ${f.message.replace(/\|/g, '\\|')} | ${f.fix.replace(/\|/g, '\\|')} | ${f.autoFixable ? 'yes' : 'no'} |`), ''] : [];
  }),
  '## Route inventory', '', '| Route | Status | Crawl | Index | Auth | In sitemap | lastmod | Structured data |', '|---|---|---|---|---|---|---|---|',
  ...inventory.map((p) => `| ${p.route} | ${p.httpStatus} | ${p.crawl} | ${p.index} | ${p.auth} | ${p.inSitemap ? 'yes' : 'no'} | ${p.lastmod || '–'} | ${p.structuredData.join(', ') || '–'} |`),
].join('\n');
await writeFile(path.join(out, 'report.md'), md + '\n');
console.log(`\nReport: .seo-reports/report.md (inventory: .seo-reports/routes.json)`);
process.exit(count(ERROR) ? 1 : 0);
