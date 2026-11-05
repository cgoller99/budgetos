import assert from "node:assert/strict";
import { prioritizeAutonomousSignals } from "../lib/ai-team/autonomousPriorities.ts";
const base = { severity: 4, affectedUsers: 10, confidence: 0.9, evidence: ["measured event"], proposedAction: "Investigate" };
const results = prioritizeAutonomousSignals([
  { ...base, id: "growth", title: "Improve signup", source: "growth" },
  { ...base, id: "security", title: "Investigate auth issue", source: "security", requiresExternalAction: true },
  { ...base, id: "security", title: "Duplicate", source: "security" },
  { ...base, id: "invalid", title: "Unsupported claim", source: "revenue", evidence: [] },
]);
assert.deepEqual(results.map(x => x.id), ["security", "growth"]);
assert.equal(results[0].execution, "review_required");
assert.equal(results[1].execution, "proposal_only");
assert.deepEqual(prioritizeAutonomousSignals([]), []);
assert.deepEqual(prioritizeAutonomousSignals([{ ...base, id: "bad", title: "bad", source: "growth", confidence: Number.NaN }]), []);
console.log("Autonomous priority policy tests passed.");
