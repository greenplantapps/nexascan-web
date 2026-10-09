# NexaScan site SEO policy

How this particular site handles each search signal. Facts as of 2026-10-09; update this file when the
hosting or build changes.

## Hosting and its limits

- GitHub Pages project site: `https://greenplantapps.github.io/nexascan-web/` (`siteUrl` in `site.config.json`).
  Deployed by `.github/workflows/pages.yml` on every push to `main`.
- Pages cannot send custom headers (no `X-Robots-Tag`) or server-side redirects. Index control is the
  robots meta tag only.
- A missing URL returns a real HTTP 404 with `404.html` (no soft-404 risk). `/page` redirects to `/page/`
  (301) and `http` to `https` (301).
- **robots.txt:** Google reads it only at a host root. A file under `/nexascan-web/` is ignored, and the
  host root (`greenplantapps.github.io/robots.txt`) returns 404, which means "crawl everything". So there is
  no robots.txt on this host; the sitemap is submitted in Search Console instead.
- **Site name and favicon in Google** are per host, so they are not available on the github.io subpath.
- **Custom domain** (owner decision, see `docs/SEO-MANUAL-STEPS.md` Step 1) fixes both. When `siteUrl` is a
  host root, the build writes `robots.txt` (allow all + `Sitemap:`) automatically, and every canonical,
  sitemap URL and JSON-LD URL follows `siteUrl`.

## Where each signal comes from

| Signal | Source | Notes |
|---|---|---|
| `<title>`, meta description | page front matter `title`, `description` | Unique per page. Google may rewrite either. |
| Canonical, `og:url` | build, from `siteUrl` + page path | Absolute, https, trailing slash, self-referencing. Only on indexable pages. |
| noindex | front matter `"index": false` | 404 is always noindex. Never combine with a robots.txt block. |
| sitemap.xml | build | Indexable canonical URLs only, home first. `lastmod` = last commit touching the page (and `plans.json` for generated pages); omitted without full git history. |
| Structured data | `scripts/build.mjs` `jsonLd()` | Home page only: `WebSite` (name NexaScan) and `Organization` (GreenPlant Technologies). No logo claim, no ratings. |
| Search Console verification | `site.config.json` `seo.googleSiteVerification` | Meta tag on the home page; keep it forever once verified. |
| Social previews | layout `og:*`, `twitter:card`, `assets/brand/og-image.png` | For social platforms; not a ranking signal. |
| Free/Pro and pricing facts | `src/data/plans.json` | Generated into Features and Pricing. Prices shown only when `pricing.confirmed` is true. |
| Download buttons | `site.config.json` `storeUrl` | Empty: "Coming to Google Play". Set: the official badge links to the listing everywhere. |

## URL inventory (current)

All public, no authentication anywhere: `/`, `/features/`, `/pricing/`, `/faq/`, `/support/`, `/privacy/`,
`/terms/` are indexable; `404.html` is noindex. The privacy URL is used by the Play Console listing: never move it.

## Environment safety

Local preview (`npm run serve`, `http://localhost:4173/nexascan-web/`) still renders production canonicals,
because they come from `siteUrl`. The audit fails if any canonical, `og:url`, sitemap or JSON-LD URL points
at localhost, a preview/staging host or `file:`. There is no staging deployment.

## Accuracy rule

Every product, privacy and security claim must match the app (PDFToolKit repository: product catalogue,
manifest, source). The privacy policy must match the app's permissions, network calls and Play Data safety
answers. When in doubt, leave the claim out and ask the owner.
