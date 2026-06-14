/** Typed errors mirroring the API's error taxonomy (api/src/routes/search.ts).
 *  isRetryable marks the transient ones the client retries automatically. */

export type SerpCheapErrorCode =
  | "invalid_request"
  | "missing_api_key"
  | "unknown_api_key"
  | "inactive_api_key"
  | "account_blocked"
  | "insufficient_credits"
  | "rate_limited"
  | "request_in_progress"
  | "too_many_concurrent_requests"
  | "service_temporarily_unavailable"
  | "result_timeout"
  | "client_timeout"
  | "network_error"
  | "invalid_response"
  | "internal";

const RETRYABLE: ReadonlySet<SerpCheapErrorCode> = new Set([
  "rate_limited",
  "too_many_concurrent_requests",
  "service_temporarily_unavailable",
  "result_timeout",
  "client_timeout",
  "network_error",
]);

export interface SerpCheapErrorOptions {
  status?: number;
  retryAfterMs?: number;
  details?: unknown;
}

export class SerpCheapError extends Error {
  readonly code: SerpCheapErrorCode;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly details?: unknown;

  constructor(code: SerpCheapErrorCode, message: string, opts: SerpCheapErrorOptions = {}) {
    super(message);
    this.name = "SerpCheapError";
    this.code = code;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.details = opts.details;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Map a non-2xx /v1/search response (status + parsed body) to a typed error. */
export function mapApiError(status: number, body: unknown): SerpCheapError {
  const b = rec(body);
  const apiCode = typeof b.error === "string" ? b.error : "";
  const msg = typeof b.message === "string" ? b.message : "";

  switch (apiCode) {
    case "invalid_request":
      return new SerpCheapError("invalid_request", msg || "The request parameters were rejected.", { status, details: b.details });
    case "missing_api_key":
      return new SerpCheapError("missing_api_key", msg || "No API key was sent.", { status });
    case "unknown_api_key":
      return new SerpCheapError("unknown_api_key", "The API key is not recognized.", { status });
    case "inactive_api_key":
      return new SerpCheapError("inactive_api_key", "The API key is inactive.", { status });
    case "account_blocked":
      return new SerpCheapError("account_blocked", msg || "This account is blocked.", { status });
    case "insufficient_credits": {
      const required = typeof b.required === "number" ? b.required : undefined;
      const balance = typeof b.balance === "number" ? b.balance : undefined;
      const detail = required !== undefined && balance !== undefined ? ` (needs ${required}, balance ${balance})` : "";
      return new SerpCheapError("insufficient_credits", `Not enough credits${detail}.`, { status });
    }
    case "rate_limited": {
      const retryAfterMs = typeof b.retry_after_ms === "number" ? b.retry_after_ms : undefined;
      return new SerpCheapError("rate_limited", `Rate limit exceeded${retryAfterMs ? `; retry in ${retryAfterMs} ms` : ""}.`, { status, retryAfterMs });
    }
    case "request_in_progress":
      return new SerpCheapError("request_in_progress", "An identical request is in flight.", { status });
    case "too_many_concurrent_requests":
      return new SerpCheapError("too_many_concurrent_requests", msg || "Too many concurrent requests.", { status });
    case "service_temporarily_unavailable":
      return new SerpCheapError("service_temporarily_unavailable", msg || "Temporarily unavailable.", { status });
    case "result_timeout":
      return new SerpCheapError("result_timeout", msg || "The search timed out.", { status });
  }

  if (status === 401) return new SerpCheapError("unknown_api_key", msg || "Authentication failed.", { status });
  if (status === 403) return new SerpCheapError("account_blocked", msg || "Access denied.", { status });
  if (status === 429) return new SerpCheapError("rate_limited", "Rate limit exceeded.", { status });
  if (status >= 500) return new SerpCheapError("service_temporarily_unavailable", `HTTP ${status}.`, { status });
  return new SerpCheapError("internal", msg || `serp.cheap API returned HTTP ${status}.`, { status });
}
