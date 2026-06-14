import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap, SerpCheapError } from "../src/index.js";
import { golden, jsonResponse, recordingFetch, sequenceFetch, bodyOf } from "./fixtures.js";

test("empty api key throws missing_api_key synchronously", () => {
  assert.throws(
    () => new SerpCheap(""),
    (e: unknown) => e instanceof SerpCheapError && e.code === "missing_api_key",
  );
});

test("constructor applies defaults", async () => {
  const { fetch, calls } = recordingFetch(jsonResponse(200, golden));
  const client = new SerpCheap("k", { fetch });
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://api.serp.cheap/v1/search");
});

test("constructor options override defaults", async () => {
  const { fetch, calls } = recordingFetch(jsonResponse(200, golden));
  const client = new SerpCheap("k", { fetch, baseUrl: "https://other.test", timeoutMs: 1, maxRetries: 0 });
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://other.test/v1/search");
});

test("searchPages yields pages from..to and stops on first empty organic", async () => {
  const page = (n: number, empty = false) =>
    jsonResponse(200, { search: "x", page: n, organic: empty ? [] : [{ position: 1, title: "t", link: "l", snippet: "s" }] });
  const { fetch, calls } = sequenceFetch([page(1), page(2), page(3, true), page(4)]);
  const client = new SerpCheap("k", { fetch });

  const pages = [];
  for await (const p of client.searchPages({ q: "hi" }, 1, 5)) pages.push(p);

  assert.equal(pages.length, 3);
  assert.deepEqual(calls.map((c) => bodyOf(c).page), [1, 2, 3]);
  assert.equal(pages[2].organic.length, 0);
});

test("searchPages respects from/to bounds", async () => {
  const full = jsonResponse(200, { search: "x", page: 1, organic: [{ position: 1, title: "t", link: "l", snippet: "s" }] });
  const { fetch, calls } = sequenceFetch([full, full, full]);
  const client = new SerpCheap("k", { fetch });

  const pages = [];
  for await (const p of client.searchPages({ q: "hi" }, 2, 4)) pages.push(p);

  assert.equal(pages.length, 3);
  assert.deepEqual(calls.map((c) => bodyOf(c).page), [2, 3, 4]);
});

test("searchPages stops exactly at empty without fetching beyond", async () => {
  const empty = jsonResponse(200, { search: "x", page: 1, organic: [] });
  const { fetch, calls } = sequenceFetch([empty, empty]);
  const client = new SerpCheap("k", { fetch });

  const pages = [];
  for await (const p of client.searchPages({ q: "hi" }, 1, 10)) pages.push(p);

  assert.equal(pages.length, 1);
  assert.equal(calls.length, 1);
});
