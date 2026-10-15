#!/usr/bin/env node
/**
 * Safe, non-destructive remediation proposal for existing Income Plans that are
 * missing linked_income_source_id.
 *
 * Does NOT write to production. Prints candidates that are safe to backfill:
 * exactly one active income source for that user (stable id, no ambiguity).
 *
 * Usage (read-only against a loaded dump or via operator review):
 *   node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/propose-income-plan-link-remediation.mjs
 *
 * Recommended SQL for operators (run only after review):
 *   -- Preview only
 *   SELECT p.id AS plan_id, p.user_id, t.id AS income_source_id
 *   FROM income_plans p
 *   JOIN LATERAL (
 *     SELECT id FROM transactions
 *     WHERE user_id = p.user_id
 *       AND transaction_type = 'income'
 *       AND COALESCE(recurring_status, 'active') <> 'paused'
 *   ) AS only_source ON TRUE
 *   WHERE p.linked_income_source_id IS NULL
 *     AND (
 *       SELECT COUNT(*) FROM transactions t2
 *       WHERE t2.user_id = p.user_id
 *         AND t2.transaction_type = 'income'
 *         AND COALESCE(t2.recurring_status, 'active') <> 'paused'
 *     ) = 1;
 *
 * Ambiguous users (2+ income sources) must choose a link in-product — never
 * auto-merge by name or amount.
 */
import { isSafeIncomePlanLinkBackfillCandidate } from "../lib/incomePlan/linkIncomeSource.ts";

const examples = [
  {
    label: "safe singleton",
    linkedIncomeSourceId: null,
    incomeSources: [{ id: "a", schedule: { status: "active" } }],
  },
  {
    label: "already linked",
    linkedIncomeSourceId: "a",
    incomeSources: [{ id: "a", schedule: { status: "active" } }],
  },
  {
    label: "ambiguous two jobs",
    linkedIncomeSourceId: null,
    incomeSources: [
      { id: "a", schedule: { status: "active" } },
      { id: "b", schedule: { status: "active" } },
    ],
  },
];

for (const example of examples) {
  const safe = isSafeIncomePlanLinkBackfillCandidate(example);
  console.log(`${example.label}: ${safe ? "CANDIDATE" : "SKIP"}`);
}

console.log(
  "\nRemediation policy: backfill ONLY safe singleton candidates after human review.",
);
