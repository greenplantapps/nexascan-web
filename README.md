# NexaScan website

The public product site for **NexaScan – AI Scanner & PDF Tools**, by GreenPlant Technologies.
Static HTML/CSS/JS, built by a small dependency-free Node script and deployed to GitHub Pages.

## Pages

| URL | Page |
|---|---|
| `/` | Home |
| `/features/` | Features |
| `/pricing/` | Free and Pro |
| `/privacy/` | Privacy policy (Google Play) |
| `/terms/` | Terms of use |
| `/support/` | Support |
| `/faq/` | FAQ |

## Everyday edits

- **Launch day:** put the Google Play listing URL in `site.config.json` → `storeUrl`. Every download button switches
  from "Coming soon on Google Play" to a live link.
- **Contacts and legal details:** `supportEmail`, `privacyEmail` and `developer` in `site.config.json`. Pages that
  still need owner input show a highlighted `[… REQUIRED]` marker; `knownPlaceholders` lists the outstanding ones.
- **Custom domain:** change `siteUrl` in `site.config.json` and add a `public/CNAME` file (copy it in `scripts/build.mjs`).
- **Copy:** pages are in `src/pages/<name>/index.html`; the header, footer and download band are in `src/partials/`.

## Screenshots

Real captures from the Android app. Put raw PNGs in `screenshots-raw/` (gitignored, never published), review
them for personal data, then run `npm install` once and `npm run images`. That writes optimised WebP files to
`assets/screenshots/` and regenerates the favicon and social image from `assets/brand/nexascan-logo.svg`, which is
the app's own logo.

## Build and check

```bash
npm run build     # dist/
npm run check     # every link and image resolves, one h1 per page, alt text, titles, descriptions
npm run serve     # http://localhost:4173/nexascan-web/ (the GitHub Pages path)
```

Pushing to `main` runs `.github/workflows/pages.yml`, which builds, checks and deploys. In the repository's
**Settings › Pages**, set **Source** to **GitHub Actions** once.

## Accuracy rule

Every product, privacy and security claim on this site was checked against the app's source code. Before
changing a claim, check it against the app. The privacy policy in particular must stay in step with the
app's permissions, SDKs and billing.
