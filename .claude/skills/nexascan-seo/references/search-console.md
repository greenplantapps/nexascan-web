# Search Console: what is automatable

Last verified: **2026-10-08**. Search Console is optional: the website and `npm run verify` never need it.
No API client is installed in this repository yet (it needs separate owner approval); until then, use the
Search Console website and `docs/SEO-MANUAL-STEPS.md`.

## Owner-only actions (cannot be automated)

- Creating and verifying the property. On github.io only a **URL-prefix** property is possible
  (`https://greenplantapps.github.io/nexascan-web/`), verified with the HTML tag that the build adds from
  `site.config.json` `seo.googleSiteVerification`. A Domain property needs DNS, so it needs a custom domain.
- Consenting to API access and managing users (owners only).
- **Request indexing** and **Test live URL**: Search Console website only, for owners and full users.
  Use them rarely, for a launch or a fixed error; they don't speed up ranking.

## What the Search Console API can do

Auth is OAuth 2.0 only (`https://www.googleapis.com/auth/webmasters.readonly`, or `webmasters` for sitemap
submission), for a Google account that has access to the property. Service accounts are not documented for
this API: plan on an OAuth desktop client with the owner's one-time consent, and keep the token outside the
repository (or in a GitHub secret if CI uses it).

| Need | Method | Notes |
|---|---|---|
| Property access check | `sites.get` / `sites.list` | Returns the permission level (owner, full, restricted). |
| Submit or check the sitemap | `sitemaps.submit`, `sitemaps.get`, `sitemaps.list` | Submit needs owner or full permission and the `webmasters` scope. Shows last download, warnings, errors. |
| Search performance | `searchanalytics.query` | Clicks, impressions, CTR, position by query, page, country, device, date. Top rows only; anonymised queries omitted; about 16 months of data. |
| Index status of a URL | `urlInspection.index.inspect` | Google's **indexed** version only: `verdict`, `coverageState`, `robotsTxtState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `googleCanonical` vs `userCanonical`, `sitemap`, `referringUrls`, `richResultsResult`. No live test, no indexing request. Quota 2,000/day and 600/min per property. |

There is no API for the aggregate Page indexing report; inspect important URLs one by one (7 pages here).

## Not for this site

- **Indexing API:** only for pages with `JobPosting` or `BroadcastEvent` in `VideoObject`. Marketing pages
  must not use it. <https://developers.google.com/search/apis/indexing-api/v3/quickstart>
- Sitemap ping URLs (retired), SERP scraping and paid rank trackers.

## If automation is approved later

Keep it small: one zero-dependency script (`fetch` + OAuth refresh-token exchange) that runs `sites.get`,
`sitemaps.list`/`submit`, a 28-day `searchanalytics.query` summary and `urlInspection` for the sitemap URLs,
writes `.seo-reports/search-console.md`, and reports `AUTH REQUIRED` (exit 0) when no credentials are present.
A scheduled run needs an explicit schedule (GitHub Actions `schedule` with the token as a secret, or a Claude
Code routine) and the owner's approval.

Sources: <https://developers.google.com/webmaster-tools/v1/how-tos/authorizing> ·
<https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult> ·
<https://developers.google.com/webmaster-tools/limits> · <https://support.google.com/webmasters/answer/9008080> ·
<https://support.google.com/webmasters/answer/2451999>
