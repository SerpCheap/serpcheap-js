import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap } from "../src/index.js";
import { jsonResponse, recordingFetch, bodyOf } from "./fixtures.js";

const ok = {
  url: "example.com",
  search: "shoes",
  gl: "us",
  match_type: "domain",
  pages_scanned: 1,
  found: false,
  rank: null,
  matches: [],
  organic: [],
  partial: false,
  pages_failed: [],
};

function clientWith() {
  const { fetch, calls } = recordingFetch(jsonResponse(200, ok));
  return { client: new SerpCheap("secret-key", { fetch }), calls };
}

test("rank POSTs to /v1/rank with defaults", async () => {
  const { client, calls } = clientWith();
  await client.rank({ url: "example.com", q: "shoes" });
  assert.equal(calls[0].url, "https://api.serp.cheap/v1/rank");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(bodyOf(calls[0]), {
    url: "example.com",
    q: "shoes",
    gl: "us",
    pages: 1,
    match_type: "domain",
  });
});

test("rank forwards only set optional fields", async () => {
  const { client, calls } = clientWith();
  await client.rank({ url: "example.com", q: "shoes", gl: "br", hl: "pt-BR", tbs: "qdr:d", pages: 3, match_type: "exact" });
  assert.deepEqual(bodyOf(calls[0]), {
    url: "example.com",
    q: "shoes",
    gl: "br",
    pages: 3,
    match_type: "exact",
    hl: "pt-BR",
    tbs: "qdr:d",
  });
});

test("rank omits hl and tbs when not provided", async () => {
  const { client, calls } = clientWith();
  await client.rank({ url: "example.com", q: "shoes" });
  const b = bodyOf(calls[0]);
  assert.ok(!("hl" in b));
  assert.ok(!("tbs" in b));
});

test("rank response exposes matches, organic and stats", async () => {
  const canned = {
    url: "example.com",
    search: "shoes",
    gl: "us",
    match_type: "domain",
    pages_scanned: 2,
    found: true,
    rank: 12,
    matches: [{ rank: 12, page: 2, position_on_page: 2, link: "https://example.com/p", title: "Shoes" }],
    organic: [
      { position: 1, title: "t1", link: "l1", snippet: "s1" },
      { position: 12, title: "Shoes", link: "https://example.com/p", snippet: "s12" },
    ],
    partial: true,
    pages_failed: [3],
    stats: { balance: 980, cost: 12, pages_cached: 1, pages_fresh: 1 },
  };
  const { fetch } = recordingFetch(jsonResponse(200, canned));
  const res = await new SerpCheap("k", { fetch }).rank({ url: "example.com", q: "shoes", pages: 2 });
  assert.equal(res.found, true);
  assert.equal(res.rank, 12);
  assert.equal(res.pages_scanned, 2);
  assert.equal(res.matches[0].position_on_page, 2);
  assert.equal(res.organic.length, 2);
  assert.equal(res.organic[1].link, "https://example.com/p");
  assert.deepEqual(res.pages_failed, [3]);
  assert.equal(res.partial, true);
  assert.equal(res.stats?.pages_cached, 1);
  assert.equal(res.stats?.pages_fresh, 1);
});

test("rank handles found:false with null rank", async () => {
  const { fetch } = recordingFetch(jsonResponse(200, ok));
  const res = await new SerpCheap("k", { fetch }).rank({ url: "example.com", q: "shoes" });
  assert.equal(res.found, false);
  assert.equal(res.rank, null);
  assert.equal(res.matches.length, 0);
});
