import { test } from "node:test";
import assert from "node:assert/strict";
import { SerpCheap, VERSION } from "../src/index.js";
import { golden, jsonResponse, recordingFetch, bodyOf, headersOf } from "./fixtures.js";

function clientWith(opts: Record<string, unknown> = {}) {
  const { fetch, calls } = recordingFetch(jsonResponse(200, golden));
  return { client: new SerpCheap("secret-key", { fetch, ...opts }), calls };
}

test("POST to default baseUrl /v1/search", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://api.serp.cheap/v1/search");
  assert.equal(calls[0].init.method, "POST");
});

test("custom baseUrl honored", async () => {
  const { client, calls } = clientWith({ baseUrl: "https://example.test" });
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://example.test/v1/search");
});

test("trailing slash baseUrl normalized", async () => {
  const { client, calls } = clientWith({ baseUrl: "https://x/" });
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://x/v1/search");
});

test("multiple trailing slashes normalized", async () => {
  const { client, calls } = clientWith({ baseUrl: "https://x///" });
  await client.search({ q: "hi" });
  assert.equal(calls[0].url, "https://x/v1/search");
});

test("headers are exact", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  const h = headersOf(calls[0]);
  assert.equal(h["content-type"], "application/json");
  assert.equal(h["x-api-key"], "secret-key");
  assert.equal(h["user-agent"], `serpcheap-js/${VERSION}`);
  assert.ok(h["user-agent"].includes(VERSION));
});

test("body has q", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "best shoes" });
  assert.equal(bodyOf(calls[0]).q, "best shoes");
});

test("gl defaults to us when omitted", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  assert.equal(bodyOf(calls[0]).gl, "us");
});

test("gl passed through when provided", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi", gl: "br" });
  assert.equal(bodyOf(calls[0]).gl, "br");
});

test("page defaults to 1", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  assert.equal(bodyOf(calls[0]).page, 1);
});

test("page passed through", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi", page: 4 });
  assert.equal(bodyOf(calls[0]).page, 4);
});

test("hl and tbs omitted when not provided", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi" });
  const b = bodyOf(calls[0]);
  assert.ok(!("hl" in b));
  assert.ok(!("tbs" in b));
});

test("hl and tbs included when provided", async () => {
  const { client, calls } = clientWith();
  await client.search({ q: "hi", hl: "pt-BR", tbs: "qdr:d" });
  const b = bodyOf(calls[0]);
  assert.equal(b.hl, "pt-BR");
  assert.equal(b.tbs, "qdr:d");
});
