import assert from "node:assert/strict";

function getOnboardingTotalSteps(progress) {
  if (progress.setupPath === "plaid") {
    return 4;
  }

  return 10;
}

function shouldShowPlaidConnectBanner(input) {
  if (input.dismissed || input.hasPlaidConnection) {
    return false;
  }

  return (
    input.progress.showPlaidConnectBanner === true ||
    input.progress.setupPath === "plaid" ||
    input.progress.skippedManualAccounts === true ||
    input.accountCount === 0
  );
}

function getManualAccounts(accounts) {
  return accounts.filter((account) => !account.bankConnectionId);
}

assert.equal(getOnboardingTotalSteps({ setupPath: "plaid" }), 4);
assert.equal(getOnboardingTotalSteps({ setupPath: "manual" }), 10);
assert.equal(getOnboardingTotalSteps({}), 10);

assert.equal(
  shouldShowPlaidConnectBanner({
    dismissed: false,
    hasPlaidConnection: false,
    progress: { setupPath: "plaid" },
    accountCount: 2,
  }),
  true,
);

assert.equal(
  shouldShowPlaidConnectBanner({
    dismissed: true,
    hasPlaidConnection: false,
    progress: { setupPath: "plaid" },
    accountCount: 0,
  }),
  false,
);

assert.equal(
  shouldShowPlaidConnectBanner({
    dismissed: false,
    hasPlaidConnection: true,
    progress: { setupPath: "plaid" },
    accountCount: 0,
  }),
  false,
);

assert.equal(
  shouldShowPlaidConnectBanner({
    dismissed: false,
    hasPlaidConnection: false,
    progress: { setupPath: "manual", skippedManualAccounts: true },
    accountCount: 0,
  }),
  true,
);

assert.equal(
  shouldShowPlaidConnectBanner({
    dismissed: false,
    hasPlaidConnection: false,
    progress: { setupPath: "manual" },
    accountCount: 3,
  }),
  false,
);

assert.deepEqual(
  getManualAccounts([
    { bankConnectionId: null },
    { bankConnectionId: "abc" },
    { bankConnectionId: null },
  ]),
  [{ bankConnectionId: null }, { bankConnectionId: null }],
);

console.log("onboarding progress tests passed");
