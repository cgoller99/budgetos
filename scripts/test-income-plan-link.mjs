#!/usr/bin/env node
/**
 * Income Plan ↔ income source ownership link regressions.
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { getEffectiveIncomeSources } from "../lib/finance/effectiveIncome.ts";
import { forecastCashOutlook } from "../lib/finance/cashOutlook.ts";
import {
  isSafeIncomePlanLinkBackfillCandidate,
  resolveIncomePlanLinkedSourceId,
} from "../lib/incomePlan/linkIncomeSource.ts";

const ref = new Date(2026, 9, 14, 12);

function source(partial = {}) {
  return {
    id: "src-1",
    name: "Primary Job",
    amount: 1000,
    frequency: "biweekly",
    category: "Paycheck",
    depositAccountId: "acct-1",
    schedule: {
      startDate: "2026-10-01",
      frequency: "biweekly",
      nextOccurrence: "2026-10-29",
      status: "active",
    },
    ...partial,
  };
}

function plan(partial = {}) {
  return {
    id: "plan-1",
    paySchedule: "biweekly",
    paycheckAmount: 1000,
    anchorDate: "2026-10-01",
    weeklyDayOfWeek: 5,
    monthlyDays: [1, 15],
    customIntervalDays: null,
    depositAccountId: null,
    linkedIncomeSourceId: null,
    nextPayDate: "2026-10-15",
    lastProcessedDate: null,
    isActive: true,
    allocations: [],
    ...partial,
  };
}

// Resolver: none / singleton / ambiguous / preserved / explicit
{
  assert.equal(
    resolveIncomePlanLinkedSourceId({ incomeSources: [] }).status,
    "unlinked",
  );
  assert.equal(
    resolveIncomePlanLinkedSourceId({ incomeSources: [source()] }).reason,
    "singleton",
  );
  assert.equal(
    resolveIncomePlanLinkedSourceId({
      incomeSources: [source(), source({ id: "src-2", name: "Side" })],
    }).reason,
    "ambiguous",
  );
  assert.equal(
    resolveIncomePlanLinkedSourceId({
      incomeSources: [source(), source({ id: "src-2" })],
      existingLinkedIncomeSourceId: "src-2",
    }).incomeSourceId,
    "src-2",
  );
  assert.equal(
    resolveIncomePlanLinkedSourceId({
      incomeSources: [source()],
      existingLinkedIncomeSourceId: "src-1",
      explicitLinkedIncomeSourceId: "src-1",
    }).reason,
    "explicit",
  );
  assert.equal(
    resolveIncomePlanLinkedSourceId({
      incomeSources: [source(), source({ id: "src-2" })],
      explicitLinkedIncomeSourceId: null,
    }).status,
    "unlinked",
  );
  assert.equal(
    isSafeIncomePlanLinkBackfillCandidate({
      linkedIncomeSourceId: null,
      incomeSources: [source()],
    }),
    true,
  );
  assert.equal(
    isSafeIncomePlanLinkBackfillCandidate({
      linkedIncomeSourceId: null,
      incomeSources: [source(), source({ id: "src-2" })],
    }),
    false,
  );
}

// Onboarding-style: existing source + new unlinked plan → one outlook paycheck
{
  const data = {
    ...emptyFinanceData,
    income: [source()],
    incomePlan: plan(),
  };
  const linkedId = resolveIncomePlanLinkedSourceId({
    incomeSources: data.income,
  }).incomeSourceId;
  assert.equal(linkedId, "src-1");

  const linkedData = {
    ...data,
    incomePlan: { ...data.incomePlan, linkedIncomeSourceId: linkedId },
  };
  const effective = getEffectiveIncomeSources(linkedData);
  assert.equal(effective.length, 1);
  assert.equal(effective[0].id, "src-1");

  const outlook = forecastCashOutlook(linkedData, ref);
  const paycheckEvents = outlook.events.filter((event) => event.amount > 0);
  const names = new Set(paycheckEvents.map((event) => event.name));
  assert.equal(names.has("Paycheck (Income Plan)"), false);
  assert.equal(names.has("Primary Job"), true);
}

// Edit amount/frequency preserves explicit link
{
  const existing = plan({ linkedIncomeSourceId: "src-1", paycheckAmount: 1000 });
  const afterEdit = plan({
    linkedIncomeSourceId: existing.linkedIncomeSourceId,
    paycheckAmount: 1200,
    paySchedule: "weekly",
  });
  const resolved = resolveIncomePlanLinkedSourceId({
    incomeSources: [source()],
    existingLinkedIncomeSourceId: existing.linkedIncomeSourceId,
    explicitLinkedIncomeSourceId: afterEdit.linkedIncomeSourceId,
  });
  assert.equal(resolved.incomeSourceId, "src-1");
  assert.ok(resolved.reason === "explicit" || resolved.reason === "preserved");
}

// Plan before any income source remains projectable alone
{
  const data = { ...emptyFinanceData, income: [], incomePlan: plan() };
  const effective = getEffectiveIncomeSources(data);
  assert.equal(effective.length, 1);
  assert.equal(effective[0].id, "__buxme_income_plan__");
}

console.log("✅ Income Plan source link regressions passed.");
