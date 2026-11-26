import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createApp } from "../lib/app.mjs";
import { mountJarvis } from "../lib/mount.mjs";

const reply = {
  messageId: "msg-share-0001",
  from: "Northline Dental",
  text: "Yes, we are interested in a new website.",
};

test("approval gives one prospect link and hides every other page", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-share-"));
  const app = createApp({ dataDir: dir, env: {} });
  const saved = await app.ingest(reply);
  const headers = { host: "buxme.co", origin: "https://buxme.co", "content-type": "application/json", "x-jarvis-client": "dashboard" };
  const approve = () => app.handle(new Request("http://buxme.co/api/drafts/" + saved.draft.id + "/approval", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "outreach" }),
  }), { buxme: "required", userId: "demo-admin" });
  const first = await approve();
  const second = await approve();
  assert.equal(first.status, 202);
  const opened = await first.json();
  const again = await second.json();
  assert.equal(opened.performed, false);
  assert.equal(opened.externalAction, "not_performed");
  assert.equal(again.previewPath, opened.previewPath);
  const token = opened.previewPath.split("/").at(-1);
  const page = await mountJarvis(new Request(`https://buxme.co/jarvis/share/${token}`), app, "/jarvis", { shareToken: token });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Northline Dental/);
  assert.equal(html.includes("Needs Christian"), false);
  const wrong = await mountJarvis(new Request("https://buxme.co/jarvis/share/" + "a".repeat(43)), app, "/jarvis", { shareToken: "a".repeat(43) });
  assert.equal(wrong.status, 404);
  const tasks = await mountJarvis(new Request("https://buxme.co/jarvis/api/tasks"), app, "/jarvis", { shareToken: token });
  assert.equal(tasks.status, 404);
  const home = await mountJarvis(new Request("https://buxme.co/jarvis"), app, "/jarvis", { shareToken: token });
  assert.equal(home.status, 404);
  const adminPreview = await app.handle(new Request(`http://buxme.co/preview/${saved.preview.id}`));
  assert.equal(adminPreview.status, 401);
  const route = await readFile(new URL("../../../app/jarvis/[[...path]]/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("SHARE_PATH") < route.indexOf("verifyJarvisAdmin()"));
});
