import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap, SerpCheapError } from "../src/index.js";
import { golden, jsonResponse, textResponse, recordingFetch } from "./fixtures.js";

function client(response: Response) {
  const { fetch } = recordingFetch(response);
  return new SerpCheap("k", { fetch });
}

test("parses full golden response", async () => {
  const res = await client(jsonResponse(200, golden)).search({ q: "hi" });
  assert.equal(res.search, "best running shoes");
  assert.equal(res.page, 1);
  assert.equal(res.organic.length, 3);
  assert.deepEqual(res.organic.map((o) => o.position), [1, 2, 3]);
  assert.ok(res.knowledgeGraph);
  assert.equal(res.knowledgeGraph!.title, "Running shoe");
  assert.deepEqual(res.knowledgeGraph!.attributes, { Type: "Athletic shoe" });
  assert.equal(res.ads!.length, 1);
  assert.equal(res.ads![0].block, "top");
  assert.deepEqual(res.peopleAlsoAsk, ["What is the #1 running shoe?", "Which brand is best?"]);
  assert.equal(res.relatedSearches!.length, 1);
  assert.equal(res.relatedSearches![0].query, "best running shoes men");
  assert.deepEqual(res.stats, { balance: 994, cost: 6, cached: false });
});

test("minimal response with only organic:[] parses", async () => {
  const res = await client(jsonResponse(200, { organic: [] })).search({ q: "hi" });
  assert.deepEqual(res.organic, []);
  assert.equal(res.knowledgeGraph, undefined);
  assert.equal(res.ads, undefined);
  assert.equal(res.peopleAlsoAsk, undefined);
  assert.equal(res.relatedSearches, undefined);
  assert.equal(res.stats, undefined);
});

test("response missing optional arrays does not crash", async () => {
  const res = await client(
    jsonResponse(200, { search: "x", page: 1, organic: [{ position: 1, title: "t", link: "l", snippet: "s" }] }),
  ).search({ q: "hi" });
  assert.equal(res.organic.length, 1);
});

test("200 non-JSON body maps to invalid_response", async () => {
  await assert.rejects(
    () => client(textResponse(200, "<html>nope</html>")).search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "invalid_response",
  );
});

test("200 JSON lacking organic array maps to invalid_response", async () => {
  await assert.rejects(
    () => client(jsonResponse(200, { search: "x", page: 1 })).search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "invalid_response",
  );
});

test("200 JSON where organic is not an array maps to invalid_response", async () => {
  await assert.rejects(
    () => client(jsonResponse(200, { organic: "nope" })).search({ q: "hi" }),
    (e: unknown) => e instanceof SerpCheapError && e.code === "invalid_response",
  );
});
