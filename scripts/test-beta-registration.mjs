#!/usr/bin/env node
/**
 * Beta registration policy resolution tests (invite-only vs open).
 *
 * Usage: npm run test:beta-registration
 */

import assert from "node:assert/strict";

function resolveBetaStatusFromAccess(access) {
  if (!access.inviteOnly) {
    return access.isFull ? "pending" : "approved";
  }

  return access.allowed ? "approved" : "pending";
}

function checkBetaRegistrationAccess(settings, email, waitlistStatus, approvedCount) {
  const isFull = Boolean(
    settings.maxBetaUsers && approvedCount >= settings.maxBetaUsers,
  );

  if (!settings.inviteOnly) {
    if (isFull) {
      return {
        allowed: false,
        inviteOnly: false,
        isFull: true,
        reason: "beta_full",
      };
    }

    return {
      allowed: true,
      inviteOnly: false,
      isFull: false,
    };
  }

  if (waitlistStatus === "approved") {
    return {
      allowed: true,
      inviteOnly: true,
      isFull,
    };
  }

  return {
    allowed: false,
    inviteOnly: true,
    isFull,
    reason: "invite_only",
  };
}

// Open registration — room available
assert.equal(
  resolveBetaStatusFromAccess(
    checkBetaRegistrationAccess(
      { inviteOnly: false, maxBetaUsers: 100, waitlistEnabled: true },
      "user@example.com",
      null,
      10,
    ),
  ),
  "approved",
);

// Open registration — beta full
assert.equal(
  resolveBetaStatusFromAccess(
    checkBetaRegistrationAccess(
      { inviteOnly: false, maxBetaUsers: 50, waitlistEnabled: true },
      "user@example.com",
      null,
      50,
    ),
  ),
  "pending",
);

// Invite-only — not on waitlist
assert.equal(
  resolveBetaStatusFromAccess(
    checkBetaRegistrationAccess(
      { inviteOnly: true, maxBetaUsers: null, waitlistEnabled: true },
      "outsider@example.com",
      "pending",
      10,
    ),
  ),
  "pending",
);

// Invite-only — approved on waitlist
assert.equal(
  resolveBetaStatusFromAccess(
    checkBetaRegistrationAccess(
      { inviteOnly: true, maxBetaUsers: null, waitlistEnabled: true },
      "invited@example.com",
      "approved",
      10,
    ),
  ),
  "approved",
);

console.log("✅ Beta registration policy tests passed.");
