import assert from "node:assert/strict";

const {
  isProductionSensitiveText,
  requiresApprovalForTaskText,
} = await import("../lib/ai-team/planner.ts");

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

console.log("✅ AI Team safety-policy checks passed.");
