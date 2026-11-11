import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "jarvis-github-test-"));
const previous = { ...process.env };
const issues = [];
let posts = 0;
globalThis.fetch = async (url, options = {}) => {
  assert.match(String(url), /^https:\/\/api.github.com\/repos\/test\/repo\/issues/);
  assert.match(options.headers.Authorization, /^Bearer test-token$/);
  if (options.method === "POST") {
    const issue = JSON.parse(options.body);
    issues.push(issue); posts++;
    return { ok: true, json: async () => ({ number: posts, ...issue }) };
  }
  return { ok: true, json: async () => issues };
};
try {
  Object.assign(process.env, {
    GITHUB_TOKEN: "test-token",
    GITHUB_REPOSITORY: "test/repo",
    GITHUB_RUN_ID: "1234",
    JARVIS_QUEUE_PATH: join(dir, "queue.json"),
    JARVIS_RESULTS_DIR: join(dir, "results")
  });
  await import("./jarvis-github-execute.mjs?test=1");
  assert.equal(posts, 1);
  assert.equal(issues[0].title, "Jarvis execution: revenue-funnel-audit");
  let q = JSON.parse(await readFile(process.env.JARVIS_QUEUE_PATH, "utf8"));
  assert.equal(q[0].status, "completed");
  await import("./jarvis-github-execute.mjs?test=2");
  assert.equal(posts, 2);
  assert.equal(issues[1].title, "Jarvis execution: upgrade-conversion-review");
  await import("./jarvis-github-execute.mjs?test=3");
  assert.equal(posts, 3);
  assert.equal(issues[2].title, "Jarvis execution: organic-marketing-campaign");
  await import("./jarvis-github-execute.mjs?test=4");
  assert.equal(posts, 3);
  console.log("Jarvis GitHub runner integration passed: 3 executions, durable ledger, no duplicate run.");
} finally {
  for (const key of ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_RUN_ID", "JARVIS_QUEUE_PATH", "JARVIS_RESULTS_DIR"]) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
  await rm(dir, { recursive: true, force: true });
}
