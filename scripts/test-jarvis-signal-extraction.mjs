import assert from "node:assert/strict";
import { signalsFromAiTeamSnapshot } from "../lib/ai-team/signalExtraction.ts";
import { prioritizeAutonomousSignals } from "../lib/ai-team/autonomousPriorities.ts";
const snapshot = { health: [{ id: "auth", label: "Authentication", status: "red", detail: "Elevated errors" }, { id: "api", label: "API", status: "green", detail: "Healthy" }],
  plaid: { available: true, failedSyncs: 4, syncSuccessRate: 85 },
  overview: { totalBugReports: 2 }, revenue: { available: true, failedPayments: 1 } };
const signals = signalsFromAiTeamSnapshot(snapshot);
assert.equal(signals.length, 4);
assert.equal(signals.some(x => x.id === "health:api"), false);
const priorities = prioritizeAutonomousSignals(signals);
assert.equal(priorities[0].source, "reliability");
assert.equal(priorities.every(x => x.execution === "proposal_only"), true);
assert.deepEqual(signalsFromAiTeamSnapshot({ health: [], overview: null, plaid: null, revenue: null }), []);
console.log("Jarvis live-metric signal extraction tests passed.");
