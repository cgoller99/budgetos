/**
 * Bill payment reconciliation tests (pure JS, no DB).
 *
 * Usage: node scripts/test-bill-reconciliation.mjs
 */

import assert from "node:assert/strict";

function normalizeMerchantKey(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMerchantMatch(billName, transactionText) {
  const billKey = normalizeMerchantKey(billName);
  const txnKey = normalizeMerchantKey(transactionText);
  if (!billKey || !txnKey) return { match: false, score: 0 };
  if (billKey === txnKey || billKey.includes(txnKey) || txnKey.includes(billKey)) {
    return { match: true, score: 85 };
  }
  return { match: false, score: 0 };
}

function amountsMatch(billAmount, transactionAmount, toleranceRatio = 0.05) {
  const tolerance = Math.max(billAmount * toleranceRatio, 1);
  return Math.abs(transactionAmount - billAmount) <= tolerance;
}

assert.equal(normalizeMerchantKey("  NETFLIX.COM  "), "netflix com");
assert.equal(scoreMerchantMatch("Netflix", "NETFLIX.COM").match, true);
assert.equal(amountsMatch(100, 103), true);
assert.equal(amountsMatch(100, 120), false);

console.log("bill reconciliation tests passed");
