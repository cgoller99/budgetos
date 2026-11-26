/**
 * Guardrail for Jarvis coding jobs. Reject protected paths, unsafe git operations,
 * binary changes, and unbounded diffs before any PR can be proposed.
 */
import { execFileSync } from "node:child_process";
const base = process.env.JARVIS_BASE_REF || "origin/main";
if (!/^(origin\/main|[a-f0-9]{40})$/.test(base)) throw Error("Invalid base ref.");
const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const deleted = execFileSync("git", ["diff", "--name-only", "--diff-filter=D", base, "HEAD"], { encoding: "utf8" }).trim();
const forbidden = /(^|\/)(\.env[^/]*|\.github|supabase|migrations|middleware\.ts|package-lock\.json|package\.json|next\.config\.[^/]+|vercel\.json)(\/|$)|(^|\/)(api\/(auth|stripe|plaid|webhooks|billing|payments)|lib\/(auth|stripe|plaid|supabase|billing|payments)|app\/(api\/)?(admin|account|settings))(\/|$)/i;

function hourlyBusinessScheduleOnly() {
  const patch = execFileSync("git", ["diff", "--unified=0", base, "HEAD", "--", "vercel.json"], { encoding: "utf8" });
  const lines = patch.split(/\r?\n/).filter(line => /^[+-]/.test(line) && !line.startsWith("+++") && !line.startsWith("---"));
  return lines.length === 2
    && lines[0] === '-                      "schedule":  "15 7 * * *"'
    && lines[1] === '+                      "schedule":  "15 * * * *"';
}

if (deleted) throw Error("Jarvis cannot delete tracked files.");
if (!changed.length) throw Error("No changes to review.");
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw Error("Uncommitted changes prohibited.");
if (changed.length > 12) throw Error("Jarvis change exceeds 12 files.");
const reviewed = changed.filter(path => !(path === "vercel.json" && hourlyBusinessScheduleOnly()));
const invalid = reviewed.filter(p => forbidden.test(p) || !/\.(tsx?|jsx?|css|md|mjs|json)$/.test(p));
if (invalid.length) throw Error("Jarvis protected paths: " + invalid.join(", "));
const diff = execFileSync("git", ["diff", "--numstat", base, "HEAD"], { encoding: "utf8" });
let lines = 0;
for (const row of diff.trim().split(/\r?\n/)) {
  if (!row) continue;
  const [added, removed] = row.split("\t");
  if (added === "-" || removed === "-") throw Error("Binary changes prohibited.");
  lines += Number(added) + Number(removed);
}
if (lines > 600) throw Error("Jarvis diff exceeds 600 changed lines.");
console.log(`Jarvis guard passed: ${changed.length} files, ${lines} changed lines.`);
