# @serpcheap/sdk

Official JavaScript/TypeScript client for the [serp.cheap](https://serp.cheap) Google SERP API. Google search results as structured JSON. Zero dependencies — uses native `fetch`.

## Install

```bash
npm install @serpcheap/sdk
```

## Quickstart

```ts
import { SerpCheap } from "@serpcheap/sdk";

const client = new SerpCheap("YOUR_API_KEY");

const res = await client.search({ q: "best running shoes", gl: "us" });

for (const r of res.organic) {
  console.log(`${r.position}. ${r.title} — ${r.link}`);
}
```

## Options

```ts
new SerpCheap("YOUR_API_KEY", {
  baseUrl: "https://api.serp.cheap", // default
  timeoutMs: 5000,                  // per-request timeout, default 15s
  maxRetries: 2,                     // retries on transient errors, default 2
});
```

## Search parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | `string` | — | The search query (required). |
| `gl` | `Country` | `"us"` | Country/geolocation. |
| `hl` | `string` | — | UI language (`"en"`, `"pt-BR"`). |
| `tbs` | `Tbs` | — | Time filter — past `qdr:h` / `qdr:d` / `qdr:w`. |
| `page` | `number` | `1` | 1-indexed page. |

The response includes `organic[]`, `ads?`, `knowledgeGraph?`, `peopleAlsoAsk?`, `relatedSearches?`, and `stats` (`balance`, `cost`, `cached`).

## Scraping page content

Pass `scrape` to fetch and extract the top organic results inline. Each scraped result then carries `content` (markdown) and, when `screenshot: true`, a `screenshot_url`. Failures surface per-result as `scrape_error`.

```ts
const res = await client.search({
  q: "best running shoes",
  scrape: { render_js: true, screenshot: true, top_n: 3 },
});

for (const r of res.organic) {
  console.log(r.link, r.content, r.screenshot_url);
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `render_js` | `boolean` | `false` | Render with a headless browser before extracting. |
| `screenshot` | `boolean` | `false` | Capture a full-page screenshot. Implies a render. |
| `top_n` | `number` | `5` | How many of the top organic results to scrape. |
| `wait_for` | `string` | — | CSS selector to wait for (render_js only). |
| `wait_ms` | `number` | — | Extra settle time after load, in ms (render_js only). |
| `screenshot_width` | `number` | `1920` | Screenshot viewport width in px (max 1920). |
| `screenshot_height` | `number` | `1080` | Screenshot viewport height in px (max 1920). |

## Scrape a single page

`scrape()` fetches and extracts one URL — markdown `content`, plain `content_text`, and optionally a `screenshot_url`.

```ts
const page = await client.scrape({
  url: "https://example.com/article",
  render_js: true,
  screenshot: true,
});

console.log(page.title, page.content);
console.log(page.screenshot_url);
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `url` | `string` | — | The page URL to fetch and extract (required). |
| `render_js` | `boolean` | `false` | Render with a headless browser before extracting. |
| `screenshot` | `boolean` | `false` | Capture a screenshot. Implies a render. |
| `wait_for` | `string` | — | CSS selector to wait for (render_js only). |
| `wait_ms` | `number` | — | Extra settle time after load, in ms (render_js only). |
| `screenshot_width` | `number` | `1920` | Screenshot width in px (max 1920). |
| `screenshot_height` | `number` | `1080` | Screenshot height in px (max 1920). |

## Rank tracking

`rank()` scans Google result pages for a keyword and reports where a domain or URL lands.

```ts
const r = await client.rank({
  url: "example.com",
  q: "best running shoes",
  gl: "us",
  pages: 3,
  match_type: "domain",
});

if (r.found) {
  console.log(`Ranks #${r.rank}`);
  for (const m of r.matches) {
    console.log(`page ${m.page}, position ${m.position_on_page}: ${m.link}`);
  }
}
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `url` | `string` | — | The domain or full URL to locate (required). |
| `q` | `string` | — | The keyword to rank for (required). |
| `gl` | `Country` | `"us"` | Country/geolocation. |
| `hl` | `string` | — | UI language (`"en"`, `"pt-BR"`). |
| `tbs` | `Tbs` | — | Time filter — `qdr:h` / `qdr:d` / `qdr:w`. |
| `pages` | `number` | `1` | How many result pages to scan (1..10). |
| `match_type` | `"domain" \| "exact"` | `"domain"` | `domain` = any result on the registrable domain; `exact` = the identical URL. |

The response carries `found`, `rank` (absolute, or `null`), `matches[]`, the full `organic[]` across scanned pages, plus `partial`/`pages_failed` and `stats`.

## Pagination

```ts
for await (const page of client.searchPages({ q: "coffee makers" }, 1, 5)) {
  console.log(`page ${page.page}: ${page.organic.length} results`);
}
```

`searchPages` yields pages lazily and stops on the first empty page.

## Errors

Failures throw a `SerpCheapError` with a typed `code`, plus `status`, `retryAfterMs`, and a `retryable` flag. Transient errors (`rate_limited`, `service_temporarily_unavailable`, `result_timeout`, `client_timeout`, `network_error`, `too_many_concurrent_requests`) are retried automatically with exponential backoff, honoring `retry_after_ms`.

```ts
import { SerpCheap, SerpCheapError } from "@serpcheap/sdk";

try {
  const res = await client.search({ q: "best running shoes" });
} catch (err) {
  if (err instanceof SerpCheapError) {
    console.error(`[${err.code}] ${err.message} (retryable=${err.retryable})`);
  }
}
```

## License

MIT
