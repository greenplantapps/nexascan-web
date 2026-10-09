# Resume note: NexaScan website + SEO rework

Last updated: 2026-10-09. Use this note to pick the work up again in a new Claude Code session.

---

## 1. How to resume

Open Claude Code in this repository (`C:\Users\sreen\OneDrive\Documents\GitHub\nexascan-web`) and paste:

> Read `docs/RESUME-WEBSITE-SEO-WORK.md`, `docs/OWNER-DETAILS-NEEDED.md` and `README.md`, check `git status`
> and `git log --oneline main..website-v2`, then tell me where the website + SEO work stands and what's next.
> Don't push to main or publish anything without asking me.

Then give the next instruction, for example:
- "Here are my details: …" (fills the `[… REQUIRED]` markers, see section 5)
- "Let's do the final screenshot session" (section 6)
- "Open the pull request" or "The PR is merged, check the live site" (section 4)

---

## 2. Where things stand

| Item | Status |
|---|---|
| Stage A (validation report + plan) | Done 2026-10-08, approved by the owner |
| Stage B (implementation) | Done 2026-10-09 on branch `website-v2` |
| Live site <https://greenplantapps.github.io/nexascan-web/> | **Unchanged** (still the September site): nothing published yet |
| Branch `website-v2` | 9 commits ahead of `main`, pushed to the **fork** (`familylakkaraju/nexascan-web`) |
| Pull request into `greenplantapps/nexascan-web` | **Not opened yet** |
| Owner details (emails, legal, prices…) | **Missing**: still shown as `[… REQUIRED]` markers |
| Public Google Play listing | **None yet** (Internal testing only), so buttons read "Coming to Google Play" |
| Final screenshots (live camera, creased page) | **Pending**: needs the owner, see section 6 |
| Search Console API automation (WP7) | Not approved: documented only (skill reference `search-console.md`) |

Checks at the end of Stage B: `npm run verify` 0 errors (the 11 warnings are the owner placeholders);
`npm run seo -- --live` OK; Lighthouse mobile lab on the home page: Performance 99, Accessibility 100,
Best Practices 100, SEO 100. Pages reviewed at 360, 390, 768 and 1366 px.

---

## 3. What was built (commits on `website-v2`)

| Commit | Work package |
|---|---|
| `e2ccd1c` | docs: owner checklists (`SEO-MANUAL-STEPS.md`, `OWNER-DETAILS-NEEDED.md`) |
| `9c70580` | WP1: every claim matched to the v8 app; Free/Pro from `src/data/plans.json`; corrected privacy policy |
| `8e3adfb` | WP2: real screenshots from the Play-installed v8 app (fictional demo invoice only) |
| `0356dec` | WP4: canonical, noindex, JSON-LD (WebSite + Organization), sitemap with git `lastmod`; ignored robots.txt removed |
| `d65dbec` | WP3: branded home page and design system (Manrope, app palette, gold Pro marks, phone frames) |
| `2b464b0` | WP5: `npm run seo` audit as the CI gate (PRs checked too); logo 310 KB → 15 KB |
| `ee8bed3` | WP6: Claude Code skill `.claude/skills/nexascan-seo/` |
| `79eb627` | Preview server answers 404 outside the project path, like github.io |
| `948b190` | WP8: README and owner SEO steps |

---

## 4. Publishing (not done; needs the owner)

The account `familylakkaraju` cannot push to `greenplantapps/nexascan-web` (GitHub returned 403), so the
route is fork + pull request:

1. Open <https://github.com/greenplantapps/nexascan-web/compare/main...familylakkaraju:nexascan-web:website-v2>
   and create the pull request. CI runs `npm run verify` on it (no deploy).
2. Someone with write access to `greenplantapps` merges it. The merge to `main` deploys the site automatically.
3. After it's live: `npm run seo -- --live`, then Search Console steps in `docs/SEO-MANUAL-STEPS.md`.

Recommended: fill in the owner details first (section 5), so the published privacy policy and terms have no
`[… REQUIRED]` markers.

Rollback after a merge: `git revert -m 1 <merge commit>` on `main` and push; Actions redeploys the previous site.

---

## 5. Owner inputs still needed

All listed in `docs/OWNER-DETAILS-NEEDED.md` (fill in the Answer column, or tell Claude):
- Support email, privacy email.
- Legal entity details (name, type; company number and registered office if a company), governing law.
- Policy effective date; how long the licence service keeps licence data; confirm what it receives.
- Production prices, countries, any intro offer. Then set `pricing.confirmed: true` in `src/data/plans.json`.
- Public Google Play listing URL, which goes in `site.config.json` → `storeUrl` (every button becomes the badge).
- Optional: custom domain, Search Console verification token (`site.config.json` → `seo.googleSiteVerification`).

Where each value goes: emails, date and developer in `site.config.json`; legal paragraphs in
`src/pages/privacy/index.html` and `src/pages/terms/index.html`; then remove the matching entries from
`knownPlaceholders` in `site.config.json`.

---

## 6. Final screenshot session (with the owner)

Needed: one live-camera shot and one creased-page before/after, plus an "Original" image without the app's
Compare badge (the current `enhance-before.webp` shows the app's own "Original" label).

1. Print `D:\nexascan-web\print\print-invoice.png` and `print-letter.png` (A4, fictional "Harbour & Pine"
   documents; regenerate with `node scripts/demo-docs.mjs` if needed). Crumple and flatten the letter.
2. Owner unlocks the Pixel, keeps it awake and holds it over the printed invoice in NexaScan → Scan Document.
3. Claude captures over adb (screencap to `/sdcard/Download`, pull, delete), reviews each image for personal
   data, copies the chosen ones into `screenshots-raw/` and runs `npm run images`.
4. Commit on `website-v2`, push to the fork.

Afterwards, with the owner's OK only: remove the demo files Claude added to the phone
(`/sdcard/Pictures/NexaScanDemo/`) and the demo documents in the app's library ("Harbour and Pine invoice"
PDF/DOCX, "demo-invoice.jpg").

---

## 7. Key facts (verified 2026-10-08/09)

- App: NexaScan v8 (Play versionCode 8, Internal testing only), Android 8.0+. Source: PDFToolKit `main` 510bfb1.
- Free/Pro: `src/data/plans.json` mirrors the app's `product-catalog.json`. Free limits: 10 pages per job,
  3 files per merge, 50 MB for compression; Pro lifts them. Protect, Watermark, Page Numbers, Multi-Page,
  Edit PDF, OCR Viewer, Word/Excel Pro, Long Image and six looks are Pro.
- Prices exist only in Play Console. The test device showed £3.99/month and £29.99/year (UK); not confirmed for
  production, so not shown on the site.
- Privacy: documents are processed on the phone and never uploaded; no account, ads or analytics. After a Pro
  purchase, the app sends the purchase token and an installation id to the AccessCore licence service (v8
  points at its DEV environment). ML Kit includes Google data-transport components.
- Do not claim: AI-powered enhancement, "nothing leaves your device", watermark or handwriting removal,
  perfect shadow removal, legal e-signatures or redaction, OCR beyond Latin-script languages, "unlimited",
  iPhone.
- Hosting limits on the github.io subpath: robots.txt is ignored there, Google can't show the site's own name
  or favicon, and a Domain property isn't possible. A custom domain fixes all three.
- FAQ rich results are discontinued (May 2026); the Software App rich result needs genuine ratings. The site
  only publishes WebSite + Organization structured data.
- Never publish `D:\DocRes\Creased File.jpg` (a real person's school timetable) or DocRes model outputs.

---

## 8. Working notes for Claude

- `git` is not on PATH on this PC: use
  `$env:LOCALAPPDATA\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe` and set `$env:GIT` to it before
  `npm run build`, or the sitemap has no `lastmod`.
- adb: `C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe`. Target the Play-installed package
  `com.greenplant.nexascan` explicitly (a side-by-side test app `com.greenplant.nexascan.ew08` may also be
  installed). PowerShell `>` corrupts binary output: screencap to the device, then `adb pull`.
- Visual review: `npm run serve`, then headless Edge screenshots. For phone widths use iframes at exact widths,
  because headless Edge has a minimum window width.
- Big or temporary files go on D: (`D:\nexascan-web\…`), not C:.
- Other Claude sessions may share the Pixel or this repository. Announce phone use and branch changes, and don't
  install or uninstall apps.
- Rules: commit per work package; never push or merge `main`, and never publish without the owner's explicit
  OK; only fictional demo content in screenshots; every product or privacy claim must match the app source.

## 9. Where things are

| What | Where |
|---|---|
| Owner checklists | `docs/SEO-MANUAL-STEPS.md`, `docs/OWNER-DETAILS-NEEDED.md` |
| Free/Pro facts | `src/data/plans.json` |
| Settings (store link, contacts, SEO) | `site.config.json` |
| Build / checks / SEO audit | `scripts/build.mjs`, `scripts/check.mjs`, `scripts/seo-audit.mjs` (report in `.seo-reports/`) |
| SEO skill | `.claude/skills/nexascan-seo/` |
| CI / deploy | `.github/workflows/pages.yml` |
| Stage A report and copy deck | `D:\nexascan-web\stageA\` (`STAGE-A-REPORT.md`, `copy-deck-draft.md`) |
| Raw phone captures | `D:\nexascan-web\stageA\raw\`, `D:\nexascan-web\stageB\raw\` |
| Printable demo pages | `D:\nexascan-web\print\` |
| Review screenshots, Lighthouse | `D:\nexascan-web\review\`, `D:\nexascan-web\lighthouse\` |
