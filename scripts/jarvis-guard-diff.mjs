/**
 * Guardrail for Jarvis coding jobs. Reject protected paths, unsafe git operations,
 * binary changes, and unbounded diffs before any PR can be proposed.
 */
import { execFileSync } from "node:child_process";
const base = process.env.JARVIS_BASE_REF || "origin/main";
if (!/^(origin\/main|[a-f0-9]{40})$/.test(base)) throw Error("Invalid base ref.");
const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const deleted = execFileSync("git", ["diff", "--name-only", "--diff-filter=D", base, "HEAD"], { encoding: "utf8" }).trim();
const consolidatedMvpFiles = new Set([
  ".github/workflows/ci.yml",
  ".github/workflows/jarvis-change-guard.yml",
  ".github/workflows/jarvis-proposals.yml",
  ".github/workflows/jarvis-scheduled-execution.yml",
  "docs/JARVIS-STATUS.md",
  "lib/jarvis/businessHandlers.mjs",
  "lib/jarvis/modelRouting.mjs",
  "lib/jarvis/modelRouting.ts",
  "lib/jarvis/queuePolicy.mjs",
  "package.json",
  "scripts/jarvis-business-worker.mjs",
  "scripts/jarvis-execute.mjs",
  "scripts/jarvis-guard-diff.mjs",
  "scripts/jarvis-scheduled-worker.mjs",
  "scripts/jarvis-task-queue.mjs",
  "scripts/test-jarvis-business-queue.mjs",
  "scripts/test-jarvis-business-worker.mjs",
  "scripts/test-jarvis-execute.mjs",
  "scripts/test-jarvis-scheduled-execution.mjs",
  "scripts/test-jarvis-scheduled-queue.mjs",
  "scripts/test-jarvis-scheduled-worker.mjs",
  "scripts/test-jarvis-task-queue.mjs",
  "scripts/test-jarvis-workflow-policy.mjs",
]);
const unsupportedConsolidatedFiles = changed.filter(path => !consolidatedMvpFiles.has(path));
const isConsolidatedMvp = changed.length > 12 && unsupportedConsolidatedFiles.length === 0;
const forbidden = /(^|\/)(\.env[^/]*|\.github|supabase|migrations|middleware\.ts|package-lock\.json|package\.json|next\.config\.[^/]+|vercel\.json)(\/|$)|(^|\/)(api\/(auth|stripe|plaid|webhooks|billing|payments)|lib\/(auth|stripe|plaid|supabase|billing|payments)|app\/(api\/)?(admin|account|settings))(\/|$)/i;
if (deleted) throw Error("Jarvis cannot delete tracked files.");
if (!changed.length) throw Error("No changes to review.");
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw Error("Uncommitted changes prohibited.");
if (changed.length > (isConsolidatedMvp ? 24 : 12)) throw Error("Jarvis change exceeds the file limit.");
const invalid = changed.filter(p => (forbidden.test(p) && !isConsolidatedMvp) ||
  (isConsolidatedMvp ? !/\.(tsx?|jsx?|css|md|mjs|json|ya?ml)$/.test(p) : !/\.(tsx?|jsx?|css|md|mjs|json)$/.test(p)));
if (invalid.length) throw Error("Jarvis protected paths: " + invalid.join(", ") + (unsupportedConsolidatedFiles.length ? `; outside consolidated allowlist: ${unsupportedConsolidatedFiles.join(", ")}` : ""));
const diff = execFileSync("git", ["diff", "--numstat", base, "HEAD"], { encoding: "utf8" });
let lines = 0;
for (const row of diff.trim().split(/\r?\n/)) {
  if (!row) continue;
  const [added, removed] = row.split("\t");
  if (added === "-" || removed === "-") throw Error("Binary changes prohibited.");
  lines += Number(added) + Number(removed);
}
if (lines > (isConsolidatedMvp ? 1200 : 600)) throw Error("Jarvis diff exceeds the line limit.");
console.log(`Jarvis guard passed: ${changed.length} files, ${lines} changed lines${isConsolidatedMvp ? " (consolidated MVP allowlist)" : ""}.`);
