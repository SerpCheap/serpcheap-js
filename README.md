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
  timeoutMs: 15000,                  // per-request timeout, default 15s
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
