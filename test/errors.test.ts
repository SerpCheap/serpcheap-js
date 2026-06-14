import { test } from "node:test";
import assert from "node:assert/strict";
import { mapApiError, SerpCheapError, type SerpCheapErrorCode } from "../src/index.js";

function codeFor(status: number, body: unknown): SerpCheapErrorCode {
  return mapApiError(status, body).code;
}

test("maps each API error code", () => {
  assert.equal(codeFor(400, { error: "invalid_request" }), "invalid_request");
  assert.equal(codeFor(401, { error: "missing_api_key" }), "missing_api_key");
  assert.equal(codeFor(401, { error: "unknown_api_key" }), "unknown_api_key");
  assert.equal(codeFor(401, { error: "inactive_api_key" }), "inactive_api_key");
  assert.equal(codeFor(403, { error: "account_blocked" }), "account_blocked");
  assert.equal(codeFor(402, { error: "insufficient_credits" }), "insufficient_credits");
  assert.equal(codeFor(429, { error: "rate_limited" }), "rate_limited");
  assert.equal(codeFor(409, { error: "request_in_progress" }), "request_in_progress");
  assert.equal(codeFor(429, { error: "too_many_concurrent_requests" }), "too_many_concurrent_requests");
  assert.equal(codeFor(503, { error: "service_temporarily_unavailable" }), "service_temporarily_unavailable");
  assert.equal(codeFor(504, { error: "result_timeout" }), "result_timeout");
});

test("insufficient_credits surfaces required and balance in message", () => {
  const e = mapApiError(402, { error: "insufficient_credits", required: 6, balance: 2 });
  assert.equal(e.code, "insufficient_credits");
  assert.match(e.message, /6/);
  assert.match(e.message, /2/);
});

test("insufficient_credits without numbers omits detail", () => {
  const e = mapApiError(402, { error: "insufficient_credits" });
  assert.match(e.message, /Not enough credits\./);
});

test("rate_limited parses retry_after_ms", () => {
  const e = mapApiError(429, { error: "rate_limited", retry_after_ms: 1200 });
  assert.equal(e.retryAfterMs, 1200);
  assert.match(e.message, /1200/);
});

test("rate_limited without retry_after_ms has no retryAfterMs", () => {
  const e = mapApiError(429, { error: "rate_limited" });
  assert.equal(e.retryAfterMs, undefined);
});

test("invalid_request carries details", () => {
  const e = mapApiError(400, { error: "invalid_request", message: "bad", details: { q: "required" } });
  assert.equal(e.message, "bad");
  assert.deepEqual(e.details, { q: "required" });
});

test("custom messages are honored where allowed", () => {
  assert.equal(mapApiError(403, { error: "account_blocked", message: "you are out" }).message, "you are out");
  assert.equal(mapApiError(429, { error: "too_many_concurrent_requests", message: "slow down" }).message, "slow down");
  assert.equal(mapApiError(503, { error: "service_temporarily_unavailable", message: "brb" }).message, "brb");
  assert.equal(mapApiError(504, { error: "result_timeout", message: "too slow" }).message, "too slow");
  assert.equal(mapApiError(400, { error: "invalid_request", message: "nope" }).message, "nope");
  assert.equal(mapApiError(401, { error: "missing_api_key", message: "where key" }).message, "where key");
});

test("default messages when none supplied", () => {
  assert.match(mapApiError(400, { error: "invalid_request" }).message, /rejected/);
  assert.match(mapApiError(401, { error: "missing_api_key" }).message, /No API key/);
  assert.match(mapApiError(401, { error: "unknown_api_key" }).message, /not recognized/);
  assert.match(mapApiError(401, { error: "inactive_api_key" }).message, /inactive/);
  assert.match(mapApiError(403, { error: "account_blocked" }).message, /blocked/);
  assert.match(mapApiError(409, { error: "request_in_progress" }).message, /in flight/);
  assert.match(mapApiError(429, { error: "too_many_concurrent_requests" }).message, /concurrent/);
  assert.match(mapApiError(503, { error: "service_temporarily_unavailable" }).message, /unavailable/i);
  assert.match(mapApiError(504, { error: "result_timeout" }).message, /timed out/);
});

test("status-only fallbacks with no known body code", () => {
  assert.equal(codeFor(401, {}), "unknown_api_key");
  assert.equal(codeFor(403, {}), "account_blocked");
  assert.equal(codeFor(429, {}), "rate_limited");
  assert.equal(codeFor(500, {}), "service_temporarily_unavailable");
  assert.equal(codeFor(502, {}), "service_temporarily_unavailable");
  assert.equal(codeFor(503, {}), "service_temporarily_unavailable");
  assert.equal(codeFor(400, {}), "internal");
  assert.equal(codeFor(418, {}), "internal");
});

test("status fallbacks honor custom messages", () => {
  assert.equal(mapApiError(401, { message: "auth fail" }).message, "auth fail");
  assert.equal(mapApiError(403, { message: "denied" }).message, "denied");
  assert.match(mapApiError(429, {}).message, /Rate limit/);
  assert.match(mapApiError(500, {}).message, /HTTP 500/);
  assert.equal(mapApiError(418, { message: "teapot" }).message, "teapot");
  assert.match(mapApiError(418, {}).message, /HTTP 418/);
});

test("non-object body maps by status", () => {
  assert.equal(codeFor(401, null), "unknown_api_key");
  assert.equal(codeFor(403, "string body"), "account_blocked");
  assert.equal(codeFor(500, ["array"]), "service_temporarily_unavailable");
  assert.equal(codeFor(400, 42), "internal");
});

test("unknown body error code falls through to status", () => {
  assert.equal(codeFor(403, { error: "some_future_code" }), "account_blocked");
});

const ALL_CODES: SerpCheapErrorCode[] = [
  "invalid_request",
  "missing_api_key",
  "unknown_api_key",
  "inactive_api_key",
  "account_blocked",
  "insufficient_credits",
  "rate_limited",
  "request_in_progress",
  "too_many_concurrent_requests",
  "service_temporarily_unavailable",
  "result_timeout",
  "client_timeout",
  "network_error",
  "invalid_response",
  "internal",
];

const RETRYABLE = new Set<SerpCheapErrorCode>([
  "rate_limited",
  "too_many_concurrent_requests",
  "service_temporarily_unavailable",
  "result_timeout",
  "client_timeout",
  "network_error",
]);

test("retryable getter is true for exactly the transient codes", () => {
  for (const code of ALL_CODES) {
    const e = new SerpCheapError(code, "m");
    assert.equal(e.retryable, RETRYABLE.has(code), `retryable mismatch for ${code}`);
  }
});

test("SerpCheapError carries status/retryAfterMs/details", () => {
  const e = new SerpCheapError("rate_limited", "m", { status: 429, retryAfterMs: 5, details: { a: 1 } });
  assert.equal(e.name, "SerpCheapError");
  assert.equal(e.status, 429);
  assert.equal(e.retryAfterMs, 5);
  assert.deepEqual(e.details, { a: 1 });
  assert.ok(e instanceof Error);
});
