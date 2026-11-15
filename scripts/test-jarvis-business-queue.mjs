import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-queue-"));
const path = join(dir, "queue.json");
const env = { ...process.env, JARVIS_BUSINESS_QUEUE_PATH: path };
const run = (...args) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "scripts/jarvis-business-queue.mjs", ...args], {
    encoding: "utf8",
    env,
  });

try {
  assert.deepEqual(JSON.parse(run("list").stdout), []);
  const add = run(
    "add",
    "buxme-growth",
    "buxme",
    "business",
    "draft",
    "2026-11-15T08:00:00.000Z",
    "Draft conversion experiment",
    "--objective",
    "Review upgrade funnel copy without accessing customer data",
  );
  assert.equal(add.status, 0, add.stderr);
  assert.equal(run(
    "add",
    "agency-site",
    "website_agency",
    "coding",
    "external",
    "2026-11-15T07:00:00.000Z",
    "Prepare client website code brief",
    "--objective",
    "Draft a site brief for operator review",
  ).status, 0);
  assert.equal(run(
    "add",
    "drivenest-ops",
    "drivenest_auto_care",
    "routine",
    "observe",
    "2026-11-15T06:00:00.000Z",
    "Review service workflow",
    "--objective",
    "Identify process improvements from public workflow documentation",
  ).status, 0);

  let tasks = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(tasks.map((task) => task.business), ["buxme", "website_agency", "drivenest_auto_care"]);
  assert.ok(tasks.every((task) => task.requiresApproval === true));
  assert.ok(tasks.every((task) => task.audit[0].event === "queued"));
  assert.equal(run("claim", "2026-11-15T09:00:00.000Z").stdout.trim(), "null");

  assert.equal(run("approve", "buxme-growth", "founder").status, 0);
  assert.equal(run("approve", "agency-site", "founder").status, 0);
  const claimed = JSON.parse(run("claim", "2026-11-15T09:00:00.000Z").stdout);
  assert.equal(claimed.id, "agency-site", "earliest approved task should be claimed");
  assert.deepEqual(claimed.audit.map((entry) => entry.event), ["queued", "approved", "claimed"]);

  assert.notEqual(run("claim", "2026-11-15T09:00:00.000Z").stdout.trim(), "null");
  assert.notEqual(run("approve", "agency-site", "founder").status, 0, "running task cannot be re-approved");
  tasks = JSON.parse(await readFile(path, "utf8"));
  assert.equal(tasks.find((task) => task.id === "buxme-growth").status, "running");
  assert.equal(tasks.find((task) => task.id === "drivenest-ops").status, "queued");
  console.log("Jarvis multi-business queue passed: scope, persistence, schedule, routing, audit, and approval gate.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
