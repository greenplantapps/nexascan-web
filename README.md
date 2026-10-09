# NexaScan website

The public product site for **NexaScan – AI Scanner & PDF Tools**, by GreenPlant Technologies.
Static HTML/CSS/JS, built by a small dependency-free Node script and deployed to GitHub Pages.

## Pages

| URL | Page |
|---|---|
| `/` | Home |
| `/features/` | Every tool, grouped as in the app |
| `/pricing/` | Free and Pro |
| `/faq/` | FAQ |
| `/support/` | Support and contact |
| `/privacy/` | Privacy policy (linked from Google Play: keep this URL) |
| `/terms/` | Terms of use |

## Everyday edits

- **Launch day:** put the public Google Play listing URL in `site.config.json` → `storeUrl`. Every download
  button becomes the official "Get it on Google Play" badge. Until then, `testUrl` (a Google Play testing
  opt-in link) makes them "Install the test version" with a note that it is for invited testers; with neither,
  they read "Coming to Google Play".
- **Free and Pro facts:** `src/data/plans.json` is the only place they are written. The Features tool groups
  and the Pricing table are generated from it. Prices appear only after `pricing.confirmed` is set to `true`.
- **Contacts and legal details:** `supportEmail`, `privacyEmail`, `policyDate` and `developer` in
  `site.config.json`. Anything still missing shows as a highlighted `[… REQUIRED]` marker; see
  `docs/OWNER-DETAILS-NEEDED.md`.
- **Search Console:** paste the HTML-tag verification value into `site.config.json` → `seo.googleSiteVerification`.
  Owner-only SEO tasks are in `docs/SEO-MANUAL-STEPS.md`.
- **Custom domain:** change `siteUrl`, then set the domain in the repository's **Settings › Pages**. Canonicals,
  the sitemap and structured data follow `siteUrl`, and the build then also writes `robots.txt`.
- **Copy:** pages are in `src/pages/<name>/index.html`; the header, footer and download band are in `src/partials/`.

## Screenshots

Real captures from the Play-installed Android app, using only the fictional "Harbour & Pine" documents made by
`node scripts/demo-docs.mjs` (photo-like JPGs to import, and flat A4 PNGs to print for live-camera shots).
Put raw PNGs in `screenshots-raw/` (gitignored, never published), review them for personal data, then run
`npm install` once and `npm run images`. That crops the status and gesture bars, writes WebP files to
`assets/screenshots/`, and regenerates the site logo, favicons and social image from `src/brand/nexascan-logo.png`.

## Build and check

```bash
npm run build      # dist/
npm run check      # every link and image resolves, one h1 per page, alt text, titles, descriptions
npm run seo        # SEO audit of dist/ (add -- --live to also check the deployed site)
npm run verify     # all three: the same gate CI runs
npm run serve      # http://localhost:4173/nexascan-web/ (the GitHub Pages path)
```

The sitemap's `lastmod` comes from git history. If git isn't on your PATH, set `GIT` to the git executable
before building, or `lastmod` is left out.

## SEO

- Every page's front matter sets its `title` and `description`; `"index": false` keeps a page out of search
  (noindex, no canonical, not in the sitemap). The 404 page is always noindex.
- The build adds a self-referencing canonical, `og:url`, the sitemap entry with `lastmod`, and on the home page
  WebSite + Organization structured data (no ratings or reviews).
- `npm run seo` reports **errors** (fail the build and the deploy), **warnings** and **recommendations** (never
  fail), and writes `.seo-reports/report.md` and a route inventory.
- The Claude Code skill `.claude/skills/nexascan-seo/` runs this workflow and holds the site's SEO policy and
  the Google rules it relies on.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`: `npm run verify`, then deploy. Pull requests into `main`
run the same checks without deploying. In the repository's **Settings › Pages**, **Source** must be
**GitHub Actions**.

## Accuracy rule

Every product, privacy and security claim on this site was checked against the app's source code (PDFToolKit,
NexaScan versionCode 8). Before changing a claim, check it against the app. The privacy policy in particular
must stay in step with the app's permissions, network calls, SDKs and billing.
