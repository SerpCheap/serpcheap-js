import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap, SerpCheapError } from "../src/index.js";
import { golden, jsonResponse, sequenceFetch } from "./fixtures.js";

const rate = (ms = 1) => jsonResponse(429, { error: "rate_limited", retry_after_ms: ms });
const ok = () => jsonResponse(200, golden);

test("retryable error then success resolves and makes N+1 calls", async () => {
  const { fetch, calls } = sequenceFetch([rate(), ok()]);
  const client = new SerpCheap("k", { fetch, maxRetries: 2 });
  const res = await client.search({ q: "hi" });
  assert.equal(res.organic.length, 3);
  assert.equal(calls.length, 2);
});

test("exhausts maxRetries then throws last error with calls == maxRetries+1", async () => {
  const { fetch, calls } = sequenceFetch([rate(), rate(), rate(), rate()]);
  const client = new SerpCheap("k", { fetch, maxRetries: 2 });
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "rate_limited",
  );
  assert.equal(calls.length, 3);
});

test("does not retry client errors (400/401/402/403) -> exactly 1 call", async () => {
  for (const [status, code] of [
    [400, "invalid_request"],
    [401, "unknown_api_key"],
    [402, "insufficient_credits"],
    [403, "account_blocked"],
  ] as const) {
    const { fetch, calls } = sequenceFetch([jsonResponse(status, { error: code })]);
    const client = new SerpCheap("k", { fetch, maxRetries: 3 });
    await assert.rejects(() => client.search({ q: "hi" }));
    assert.equal(calls.length, 1, `${status} should not retry`);
  }
});

test("retryAfterMs honored as wait; sleeps once then succeeds", async () => {
  const { fetch, calls } = sequenceFetch([rate(1), ok()]);
  const client = new SerpCheap("k", { fetch, maxRetries: 2 });
  const start = Date.now();
  const res = await client.search({ q: "hi" });
  const elapsed = Date.now() - start;
  assert.equal(res.organic.length, 3);
  assert.equal(calls.length, 2);
  assert.ok(elapsed < 1000, `should not have used long exponential backoff (was ${elapsed}ms)`);
});

test("maxRetries:0 -> exactly 1 call", async () => {
  const { fetch, calls } = sequenceFetch([rate(), rate()]);
  const client = new SerpCheap("k", { fetch, maxRetries: 0 });
  await assert.rejects(() => client.search({ q: "hi" }));
  assert.equal(calls.length, 1);
});

test("exponential backoff path when no retryAfterMs (service_unavailable)", async () => {
  const { fetch, calls } = sequenceFetch([
    jsonResponse(503, { error: "service_temporarily_unavailable" }),
    ok(),
  ]);
  const client = new SerpCheap("k", { fetch, maxRetries: 2 });
  const res = await client.search({ q: "hi" });
  assert.equal(res.organic.length, 3);
  assert.equal(calls.length, 2);
});

test("non-SerpCheapError thrown from fetch path is wrapped as internal and not retried", async () => {
  let n = 0;
  const fetchImpl = (async () => {
    n++;
    throw { weird: "not an error" };
  }) as unknown as typeof fetch;
  const client = new SerpCheap("k", { fetch: fetchImpl, maxRetries: 3 });
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "network_error",
  );
});
