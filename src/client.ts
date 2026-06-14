import { mapApiError, SerpCheapError } from "./errors.js";
import type { SearchParams, SearchResponse } from "./types.js";
import { VERSION } from "./version.js";

export interface ClientOptions {
  /** Base URL of the API. Default https://api.serp.cheap */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Max automatic retries on transient errors (429/503/timeout). Default 2. */
  maxRetries?: number;
  /** Test seam. Defaults to global fetch. */
  fetch?: typeof fetch;
}

const DEFAULTS = {
  baseUrl: "https://api.serp.cheap",
  timeoutMs: 15000,
  maxRetries: 2,
};

/** Official serp.cheap SERP API client. One method: search(). */
export class SerpCheap {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, opts: ClientOptions = {}) {
    if (!apiKey) throw new SerpCheapError("missing_api_key", "An API key is required. Get one at https://app.serp.cheap.");
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
    this.maxRetries = opts.maxRetries ?? DEFAULTS.maxRetries;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** Run a Google search. Retries transient errors (429/503/timeout) with backoff. */
  async search(params: SearchParams): Promise<SearchResponse> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.once(params);
      } catch (err) {
        const e = err instanceof SerpCheapError ? err : new SerpCheapError("internal", String(err));
        if (!e.retryable || attempt >= this.maxRetries) throw e;
        const wait = e.retryAfterMs ?? Math.min(2000, 200 * 2 ** attempt);
        await sleep(wait);
        attempt++;
      }
    }
  }

  /** Lazily fetch pages [from..to] (inclusive). Stops on the first empty page. */
  async *searchPages(params: Omit<SearchParams, "page">, from = 1, to = 10): AsyncGenerator<SearchResponse> {
    for (let page = from; page <= to; page++) {
      const res = await this.search({ ...params, page });
      yield res;
      if (res.organic.length === 0) return;
    }
  }

  private async once(params: SearchParams): Promise<SearchResponse> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v1/search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "user-agent": `serpcheap-js/${VERSION}`,
        },
        body: JSON.stringify({
          q: params.q,
          gl: params.gl ?? "us",
          page: params.page ?? 1,
          ...(params.hl ? { hl: params.hl } : {}),
          ...(params.tbs ? { tbs: params.tbs } : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new SerpCheapError("client_timeout", `No response within ${this.timeoutMs} ms.`);
      }
      const raw = err instanceof Error ? err.message : String(err);
      throw new SerpCheapError("network_error", `Could not reach ${this.baseUrl}: ${raw.split(this.apiKey).join("[redacted]")}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (!res.ok) throw mapApiError(res.status, {});
      throw new SerpCheapError("invalid_response", "The API returned a non-JSON body.", { status: res.status });
    }

    if (!res.ok) throw mapApiError(res.status, body);
    if (!isSearchResponse(body)) {
      throw new SerpCheapError("invalid_response", "The API response did not match the expected shape.", { status: res.status });
    }
    return body;
  }
}

function isSearchResponse(b: unknown): b is SearchResponse {
  return typeof b === "object" && b !== null && Array.isArray((b as { organic?: unknown }).organic);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
