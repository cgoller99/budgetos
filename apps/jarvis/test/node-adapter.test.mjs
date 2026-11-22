import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { fromNode, writeNode } from "../lib/nodeAdapter.mjs";

function request(chunks, { method = "POST", url = "/api/chat", headers = {} } = {}) {
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = { host: "jarvis.example", "x-forwarded-proto": "https", ...headers };
  req.socket = { remoteAddress: "203.0.113.8" };
  return req;
}

test("node requests become bounded web requests", async () => {
  const requestBody = await fromNode(request([Buffer.from("{\"ok\":true}")], { headers: { "content-type": "application/json", "x-jarvis-ip": "spoofed" } }));
  assert.equal(requestBody.url, "https://jarvis.example/api/chat");
  assert.equal(requestBody.headers.get("x-jarvis-ip"), "203.0.113.8");
  assert.equal(await requestBody.text(), "{\"ok\":true}");
});

test("oversized node requests are rejected before they are stored", async () => {
  await assert.rejects(fromNode(request([Buffer.alloc(1_000_001)])), /too large/);
});

test("web responses are written back to node", async () => {
  const headers = [];
  const response = new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } });
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers.push([name, value]); },
    end(body) { this.body = body; },
  };
  await writeNode(res, response);
  assert.equal(res.statusCode, 201);
  assert.equal(Buffer.from(res.body).toString(), "{\"ok\":true}");
  assert.equal(headers.some(([name]) => name === "content-type"), true);
});
