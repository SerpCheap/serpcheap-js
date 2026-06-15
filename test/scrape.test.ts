import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap } from "../src/index.js";
import { golden, jsonResponse, recordingFetch, bodyOf } from "./fixtures.js";

function clientWith() {
  const { fetch, calls } = recordingFetch(jsonResponse(200, golden));
  return { client: new SerpCheap("secret-key", { fetch }), calls };
}

test("scrape omitted when not provided", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  assert.ok(!("scrape" in bodyOf(calls[0])));
});

test("scrape forwarded when provided", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi", scrape: { render_js: true, screenshot: true, top_n: 3 } });
  assert.deepEqual(bodyOf(calls[0]).scrape, { render_js: true, screenshot: true, top_n: 3 });
});

test("organic results expose scraped fields", async () => {
  const scraped = {
    search: "hi",
    page: 1,
    organic: [
      { position: 1, title: "t1", link: "l1", snippet: "s1", content: "# Page one", screenshot_url: "https://shot/1.png" },
      { position: 2, title: "t2", link: "l2", snippet: "s2", scrape_error: "blocked by robots.txt" },
    ],
  };
  const { fetch } = recordingFetch(jsonResponse(200, scraped));
  const res = await new SerpCheap("k", { fetch }).search({ q: "hi", scrape: { render_js: true } });
  assert.equal(res.organic[0].content, "# Page one");
  assert.equal(res.organic[0].screenshot_url, "https://shot/1.png");
  assert.equal(res.organic[1].scrape_error, "blocked by robots.txt");
});
