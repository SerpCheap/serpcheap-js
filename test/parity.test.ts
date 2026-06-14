import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SerpCheap, SerpCheapError } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const contract = join(here, "..", "..", "..", "contract");
const fx = JSON.parse(readFileSync(join(contract, "fixtures", "cases.json"), "utf8"));
const PORT = 8788;

let mock: ChildProcess;
const client = new SerpCheap("test-key", { baseUrl: `http://127.0.0.1:${PORT}`, maxRetries: 2, timeoutMs: 5000 });

before(async () => {
  mock = spawn("node", [join(contract, "mockserver", "server.mjs"), String(PORT)], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/healthz`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("mock server did not start");
});

after(() => mock?.kill());

for (const c of fx.cases) {
  test(`parity: ${c.name}`, async () => {
    if (c.expectError) {
      await assert.rejects(
        () => client.search({ q: c.q }),
        (e: unknown) => {
          assert.ok(e instanceof SerpCheapError, "expected SerpCheapError");
          assert.equal(e.code, c.expectError, `code mismatch for ${c.name}`);
          if (c.retryAfterMs) assert.equal(e.retryAfterMs, c.retryAfterMs);
          return true;
        },
      );
      return;
    }
    const res = await client.search({ q: c.q });
    if (c.expect?.organic !== undefined) assert.equal(res.organic.length, c.expect.organic);
    if (c.expect?.kg) assert.ok(res.knowledgeGraph, "expected knowledgeGraph");
    if (c.expect?.ads !== undefined) assert.equal(res.ads?.length ?? 0, c.expect.ads);
    if (c.expect?.cached !== undefined) assert.equal(res.stats?.cached, c.expect.cached);
  });
}

test("missing api key throws synchronously", () => {
  assert.throws(() => new SerpCheap(""), (e: unknown) => e instanceof SerpCheapError && e.code === "missing_api_key");
});
