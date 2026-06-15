import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap } from "../src/index.js";
import { jsonResponse, recordingFetch, bodyOf } from "./fixtures.js";

const ok = { url: "https://example.com" };

function clientWith() {
  const { fetch, calls } = recordingFetch(jsonResponse(200, ok));
  return { client: new SerpCheap("secret-key", { fetch }), calls };
}

test("scrape POSTs to /v1/scrape with only url when minimal", async () => {
  const { client, calls } = clientWith();
  await client.scrape({ url: "https://example.com" });
  assert.equal(calls[0].url, "https://api.serp.cheap/v1/scrape");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(bodyOf(calls[0]), { url: "https://example.com" });
});

test("scrape forwards only set fields", async () => {
  const { client, calls } = clientWith();
  await client.scrape({
    url: "https://example.com",
    render_js: true,
    screenshot: true,
    wait_for: "#main",
    wait_ms: 500,
    screenshot_width: 1280,
    screenshot_height: 720,
  });
  assert.deepEqual(bodyOf(calls[0]), {
    url: "https://example.com",
    render_js: true,
    screenshot: true,
    wait_for: "#main",
    wait_ms: 500,
    screenshot_width: 1280,
    screenshot_height: 720,
  });
});

test("scrape forwards explicit false flags", async () => {
  const { client, calls } = clientWith();
  await client.scrape({ url: "https://example.com", render_js: false });
  assert.equal(bodyOf(calls[0]).render_js, false);
});

test("scrape response exposes fields", async () => {
  const canned = {
    url: "https://example.com",
    status: 200,
    title: "Example",
    content: "# Example",
    content_text: "Example",
    screenshot_url: "https://shot/x.png",
    stats: { balance: 990, cost: 3 },
  };
  const { fetch } = recordingFetch(jsonResponse(200, canned));
  const res = await new SerpCheap("k", { fetch }).scrape({ url: "https://example.com", screenshot: true });
  assert.equal(res.url, "https://example.com");
  assert.equal(res.status, 200);
  assert.equal(res.title, "Example");
  assert.equal(res.content, "# Example");
  assert.equal(res.content_text, "Example");
  assert.equal(res.screenshot_url, "https://shot/x.png");
  assert.equal(res.stats?.balance, 990);
  assert.equal(res.stats?.cost, 3);
});
