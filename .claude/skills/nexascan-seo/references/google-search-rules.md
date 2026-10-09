# Google Search rules this site relies on

Last verified against primary sources: **2026-10-08**. Google changes features over time. Before relying on
a rule for a new decision, re-open its source; if it changed, update this file, `scripts/seo-audit.mjs` and
the date above.

## Crawling and indexing

- robots.txt applies only at the root of a host; crawlers ignore it in subdirectories. A 4xx robots.txt means
  no crawl restrictions. It controls crawling, not indexing.
  <https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt>
- `noindex` (meta tag or `X-Robots-Tag` header, same effect) works only if the page is not blocked by
  robots.txt. <https://developers.google.com/search/docs/crawling-indexing/block-indexing>
- Canonicals: absolute URLs, self-referencing, consistent with the sitemap and internal links. A canonical is
  a strong hint, not a command. <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
- Sitemaps: up to 50,000 URLs / 50 MB per file; `lastmod` is used only if consistently accurate;
  `changefreq` and `priority` are ignored; submit via Search Console, robots.txt or the API.
  <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- The sitemap ping endpoint was retired (it returns 404).
  <https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping>
- Missing pages should return 404/410; a 200 "not found" page is a soft 404.
  <https://developers.google.com/search/docs/crawling-indexing/http-network-errors>
- Google renders JavaScript, but static HTML (this site) is the safest form.
  <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>

## Appearance

- Title links: unique, descriptive, concise; no length limit; Google may rewrite.
  <https://developers.google.com/search/docs/appearance/title-link>
- Snippets: Google often writes its own; a unique meta description helps.
  <https://developers.google.com/search/docs/appearance/snippet>
- Site names (WebSite structured data) and favicons are per host, not per subdirectory.
  <https://developers.google.com/search/docs/appearance/site-names> ·
  <https://developers.google.com/search/docs/appearance/favicon-in-search>
- Organization markup has no required properties; a logo must be the organisation's own.
  <https://developers.google.com/search/docs/appearance/structured-data/organization>
- Images: real `<img>` elements with descriptive alt text. <https://developers.google.com/search/docs/appearance/google-images>

## Structured data limits

- Software App rich results require `aggregateRating` or `review`; never invent them.
  <https://developers.google.com/search/docs/appearance/structured-data/software-app> ·
  <https://developers.google.com/search/docs/appearance/structured-data/sd-policies>
- FAQ rich results are no longer shown in Google Search (May 2026); do not add FAQPage for rich results.
  <https://developers.google.com/search/updates>

## Quality and spam

- People-first, helpful content; disclose AI use where readers would expect it.
  <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Spam policies: scaled content abuse, hidden text, keyword stuffing, link schemes, doorways.
  <https://developers.google.com/search/docs/essentials/spam-policies>

## Page experience

- Core Web Vitals "good": LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile. INP replaced FID
  (March 2024). Lab tools (Lighthouse) can't measure INP; use TBT as the lab proxy. Low-traffic sites may
  have no field data. <https://web.dev/articles/vitals> · <https://support.google.com/webmasters/answer/9205520>
- Search Console's Mobile Usability report was retired in December 2023; use Lighthouse.
  <https://developers.google.com/search/blog/2023/04/page-experience-in-search>
