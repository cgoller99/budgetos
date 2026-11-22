import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { clientAddress, mountJarvis } from "../lib/mount.mjs";

const password = "correct-horse";

function env() {
  return { JARVIS_OWNER_PASSWORD: password };
}

test("the mount keeps Jarvis under /jarvis and leaves the Buxme root alone", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-mount-"));
  const app = createApp({ dataDir, env: env() });
  const health = await mountJarvis(new Request("https://buxme.co/jarvis/api/health", {
    headers: { host: "buxme.co", "x-jarvis-ip": "203.0.113.4", "x-real-ip": "198.51.100.8" },
  }), app);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).product, "jarvis");
  const page = await mountJarvis(new Request("https://buxme.co/jarvis", { headers: { host: "buxme.co" } }), app);
  const html = await page.text();
  assert.match(html, /src="\/jarvis\/app\.js"/);
  assert.match(html, /href="\/jarvis\/app\.css"/);
  const script = await mountJarvis(new Request("https://buxme.co/jarvis/app.js", { headers: { host: "buxme.co" } }), app);
  assert.match(script.headers.get("content-type"), /javascript/);
  const sound = await mountJarvis(new Request("https://buxme.co/jarvis/silence.wav", { headers: { host: "buxme.co" } }), app);
  assert.equal(sound.headers.get("content-type"), "audio/wav");
  assert.equal(new Uint8Array(await sound.arrayBuffer())[0], 0x52);
  const outside = await mountJarvis(new Request("https://buxme.co/api/health", { headers: { host: "buxme.co" } }), app);
  assert.equal(outside.status, 404);
  const escaped = await mountJarvis(new Request("https://buxme.co/jarvis/../package.json", { headers: { host: "buxme.co" } }), app);
  assert.equal(escaped.status, 404);
  const foreign = await mountJarvis(new Request("https://buxme.co/jarvis/api/session", {
    method: "POST",
    headers: { host: "buxme.co", origin: "https://evil.example", "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify({ password }),
  }), app);
  assert.equal(foreign.status, 403);
  const login = await mountJarvis(new Request("https://buxme.co/jarvis/api/session", {
    method: "POST",
    headers: { host: "buxme.co", origin: "https://buxme.co", "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify({ password }),
  }), app);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /Path=\/jarvis/);
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.4, 198.51.100.8" })), "198.51.100.8");
  const proxy = await readFile(new URL("../../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /jarvis\(\?:\/\|\$\)/);
});
