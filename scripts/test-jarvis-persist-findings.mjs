import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "jarvis-queue-test-"));
try {
  await mkdir(join(root, "jarvis-output"));
  await writeFile(join(root, "jarvis-output/priorities.json"), JSON.stringify({ priorities: [{ id: "test-signal", title: "Investigate GitHub workflow failure", score: 88, proposedAction: "Inspect logs", evidence: ["Test run"] }] }));
  const mock = `
const issues = JSON.parse(process.env.MOCK_ISSUES || "[]");
globalThis.fetch = async (url, options = {}) => {
  if (url.includes("/issues?")) return { ok: true, json: async () => issues };
  if (url.endsWith("/issues") && options.method === "POST") {
    const item = JSON.parse(options.body);
    if (!item.body.includes("jarvis-signal:test-signal")) throw Error("Missing dedup marker");
    if (!item.body.includes("Assigned agent:")) throw Error("Missing assignment");
    return { ok: true, json: async () => ({ number: 42, html_url: "https://github.com/test/issues/42" }) };
  }
  throw Error("Unexpected request: " + url);
};
await import(process.env.JARVIS_SCRIPT_URL);
`;
  await writeFile(join(root, "mock.mjs"), mock);
  const script = new URL("./jarvis-persist-findings.mjs", import.meta.url).href;
  for (const [existing, expected] of [[[], "discovered"], [[{ number: 42, state: "open", body: "<!-- jarvis-signal:test-signal -->", html_url: "https://github.com/test/issues/42" }], "existing"], [[{ number: 42, state: "closed", body: "<!-- jarvis-signal:test-signal -->", html_url: "https://github.com/test/issues/42" }], "completed"]]) {
    const result = spawnSync(process.execPath, [join(root, "mock.mjs")], { cwd: root, env: { ...process.env, GITHUB_TOKEN: "test-only", GITHUB_REPOSITORY: "test/repo", JARVIS_SCRIPT_URL: script, MOCK_ISSUES: JSON.stringify(existing) }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(join(root, "jarvis-output/persistent-queue.json"), "utf8"));
    assert.equal(report.results[0].status, expected);
  }
  console.log("Jarvis issue queue integration mocks passed: create, deduplicate, completed.");
} finally { await rm(root, { recursive: true, force: true }); }
