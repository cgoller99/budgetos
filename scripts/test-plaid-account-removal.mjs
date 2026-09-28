/**
 * Plaid account removal: ownership scope, whole-connection warning,
 * and transaction deletion order.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = "/tmp/plaid-removal-test.mjs";

execFileSync(
  path.join(ROOT, "node_modules/.bin/esbuild"),
  [
    path.join(ROOT, "lib/finance/accountPreferences.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${OUT}`,
    `--alias:@=${ROOT}`,
  ],
  { stdio: "inherit" },
);

const { listPlaidConnectionMembers } = await import(pathToFileURL(OUT).href);

const route = fs.readFileSync(
  path.join(ROOT, "app/api/accounts/disconnect-plaid/route.ts"),
  "utf8",
);
const repository = fs.readFileSync(
  path.join(ROOT, "lib/supabase/repositories/bankConnectionsRepository.ts"),
  "utf8",
);
const modal = fs.readFileSync(
  path.join(ROOT, "components/accounts/DeleteAccountModal.tsx"),
  "utf8",
);

assert.match(route, /getConnectionById\(\s*auth\.user\.id/);
assert.match(route, /listOwnedConnectionAccountIds\(\s*auth\.user\.id/);
assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
assert.match(repository, /status: "disconnected"/);
assert.match(repository, /access_token_encrypted: null/);
assert.match(repository, /transactions_cursor: null/);

const deleteTx = route.indexOf("body.deleteTransactions");
const removeCall = route.indexOf("removeConnectionAccounts");
assert.ok(deleteTx > 0 && removeCall > deleteTx, "Transactions must be deleted before accounts so history is not only detached");

assert.doesNotMatch(
  repository.slice(repository.indexOf("async removeConnectionAccounts")),
  /record_kind", "account"/,
);

const members = listPlaidConnectionMembers({
  accounts: [
    {
      id: "checking",
      name: "Checking",
      institution: "Bank",
      type: "checking",
      balance: 10,
      monthlyChange: 0,
      bankConnectionId: "conn",
      isPlaidLinked: true,
    },
    {
      id: "savings",
      name: "Savings",
      institution: "Bank",
      type: "savings",
      balance: 20,
      monthlyChange: 0,
      bankConnectionId: "conn",
      isPlaidLinked: true,
    },
  ],
  debts: [
    {
      id: "card",
      name: "Visa",
      balance: 5,
      originalBalance: 5,
      interestRate: 0,
      minimumPayment: 0,
      monthlyChange: 0,
      dueDay: 1,
      accountType: "credit_card",
      bankConnectionId: "conn",
      isPlaidLinked: true,
    },
  ],
  account: {
    id: "checking",
    name: "Checking",
    bankConnectionId: "conn",
  },
});

assert.deepEqual(
  members.map((item) => item.id),
  ["checking", "savings", "card"],
);
assert.match(modal, /Remove all \$\{connectionMembers\.length\} accounts/);
assert.match(modal, /Imported transactions stay in your history/);
assert.match(modal, /will be deleted/);
assert.match(modal, /will not sync this bank again/);

console.log("✓ Plaid account removal checks passed");
