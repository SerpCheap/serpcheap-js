import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SearchResponse } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const contract = join(here, "..", "..", "..", "contract");

export const fixtures = JSON.parse(readFileSync(join(contract, "fixtures", "cases.json"), "utf8"));
export const golden: SearchResponse = fixtures.golden;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

export interface Recorded {
  url: string;
  init: RequestInit;
}

export function recordingFetch(response: Response | (() => Response)): {
  fetch: typeof fetch;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return typeof response === "function" ? response() : response.clone();
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export function sequenceFetch(responses: Array<Response | Error>): {
  fetch: typeof fetch;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    return r.clone();
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export function bodyOf(rec: Recorded): Record<string, unknown> {
  return JSON.parse(rec.init.body as string);
}

export function headersOf(rec: Recorded): Record<string, string> {
  return rec.init.headers as Record<string, string>;
}
