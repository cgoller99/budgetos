import assert from "node:assert/strict";

const {
  isProductionSensitiveText,
  requiresApprovalForTaskContext,
  requiresApprovalForTaskText,
} = await import("../lib/ai-team/planner.ts");
const { selectAiTeamSpecialists } = await import("../lib/ai-team/routing.ts");

const approvalCases = [
  "deploy to production",
  "execute SQL against the database",
  "rotate an API key",
  "grant Pro access",
  "send an email to a customer",
  "publish a release",
  "modify permissions",
  "reset a user account",
  "run a destructive command",
  "increase ad spend",
  "change pricing",
  "export customer data",
  "wire funds",
  "issue credit",
  "archive user account",
  "increase budget",
  "post the campaign",
];

for (const value of approvalCases) {
  assert.equal(
    requiresApprovalForTaskText(value),
    true,
    `Expected approval for: ${value}`,
  );
}

const readOnlyCases = [
  "analyze retention metrics",
  "review Plaid health",
  "inspect onboarding conversion",
  "create a test plan",
  "summarize feedback trends",
];

for (const value of readOnlyCases) {
  assert.equal(
    requiresApprovalForTaskText(value),
    false,
    `Expected read-only task to remain unblocked: ${value}`,
  );
}

assert.equal(isProductionSensitiveText("deploy to production"), true);
assert.equal(isProductionSensitiveText("analyze retention metrics"), false);

assert.equal(
  requiresApprovalForTaskContext(
    "change pricing",
    "growth",
    "Analyze conversion evidence and recommend options.",
  ),
  true,
);
assert.equal(
  requiresApprovalForTaskContext(
    "change pricing",
    "analytics",
    "Analyze conversion evidence and establish a baseline.",
  ),
  false,
);

assert.deepEqual(
  selectAiTeamSpecialists("fix Plaid onboarding bug before launch"),
  ["analytics", "engineering", "qa", "product"],
);
assert.deepEqual(
  selectAiTeamSpecialists("make TikTok ads convert better"),
  ["analytics", "growth"],
);
assert.deepEqual(
  selectAiTeamSpecialists("review customer support complaints"),
  ["analytics", "customer"],
);
assert.equal(
  selectAiTeamSpecialists(
    "fix checkout flow and improve launch messaging with customer feedback",
  ).length <= 4,
  true,
);

console.log("✅ AI Team safety-policy checks passed.");
