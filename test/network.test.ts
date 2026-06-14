import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap, SerpCheapError } from "../src/index.js";

function rejectingClient(err: Error, opts: Record<string, unknown> = {}) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    throw err;
  }) as unknown as typeof fetch;
  return { client: new SerpCheap("super-secret-key", { fetch: fetchImpl, maxRetries: 0, ...opts }), getCalls: () => calls };
}

test("AbortError maps to client_timeout", async () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  const { client } = rejectingClient(err);
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "client_timeout",
  );
});

test("TimeoutError maps to client_timeout", async () => {
  const err = new Error("timed out");
  err.name = "TimeoutError";
  const { client } = rejectingClient(err);
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "client_timeout",
  );
});

test("generic Error maps to network_error", async () => {
  const { client } = rejectingClient(new Error("connection refused"));
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "network_error",
  );
});

test("api key is redacted from network_error message", async () => {
  const { client } = rejectingClient(new Error("failed talking to host with key super-secret-key in url"));
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => {
      assert.ok(e instanceof SerpCheapError);
      assert.equal(e.code, "network_error");
      assert.ok(!e.message.includes("super-secret-key"), "key must be redacted");
      assert.match(e.message, /\[redacted\]/);
      return true;
    },
  );
});

test("non-Error rejection maps to network_error", async () => {
  const fetchImpl = (async () => {
    throw "plain string failure";
  }) as unknown as typeof fetch;
  const client = new SerpCheap("k", { fetch: fetchImpl, maxRetries: 0 });
  await assert.rejects(
    () => client.search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "network_error",
  );
});
