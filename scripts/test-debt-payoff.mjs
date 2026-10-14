import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { forecastCashOutlook } from "../lib/finance/cashOutlook.ts";
import {
  EXTRA_DEBT_ALLOCATION_NAME,
  buildDebtRecommendations,
  compareDebtStrategies,
  debtDoesNotAmortize,
  incomePlanAllocationsWithExtraDebt,
  monthlyAmountFromSchedule,
  plannedExtraDebtMonthly,
  projectDebtPayoff,
  weightedAverageApr,
} from "../lib/finance/debtPayoff.ts";
import { simulateDebtPayoff } from "../lib/finance/debts.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";

const reference = new Date(2026, 9, 14, 12);

function debt(partial) {
  return {
    id: partial.id,
    name: partial.name,
    balance: partial.balance,
    interestRate: partial.interestRate ?? 0,
    minimumPayment: partial.minimumPayment,
    accountType: partial.accountType ?? "personal_loan",
  };
}

const zeroInterest = projectDebtPayoff({
  debts: [debt({ id: "a", name: "Card", balance: 100, minimumPayment: 40 })],
  strategy: "avalanche",
  extraMonthly: 10,
  referenceDate: reference,
});
assert.equal(zeroInterest.isReliable, true);
assert.equal(zeroInterest.months, 2);
assert.equal(zeroInterest.totalInterest, 0);
assert.equal(zeroInterest.totalPaid, 100);
assert.equal(zeroInterest.monthlyCommitment, 50);

const interest = projectDebtPayoff({
  debts: [debt({ id: "a", name: "Loan", balance: 100, interestRate: 12, minimumPayment: 100 })],
  strategy: "avalanche",
  referenceDate: reference,
});
assert.equal(interest.isReliable, true);
assert.equal(interest.months, 2);
assert.equal(interest.totalInterest, 1.01);
assert.equal(interest.schedule[0].interestCharged, 1);
assert.equal(interest.schedule[0].endingBalance, 1);
assert.equal(interest.schedule[1].endingBalance, 0);

const snowball = projectDebtPayoff({
  debts: [
    debt({ id: "small", name: "Small", balance: 100, minimumPayment: 50 }),
    debt({ id: "large", name: "Large", balance: 500, minimumPayment: 50 }),
  ],
  strategy: "snowball",
  referenceDate: reference,
});
assert.equal(snowball.isReliable, true);
assert.equal(snowball.months, 6);
assert.deepEqual(
  snowball.order.map((item) => item.id),
  ["small", "large"],
);
assert.equal(snowball.schedule[2].extraDebtId, "large");
assert.equal(snowball.schedule[2].lines.find((line) => line.debtId === "large").extraPayment, 50);

const avalanche = compareDebtStrategies({
  debts: [
    debt({ id: "small", name: "Small", balance: 500, interestRate: 5, minimumPayment: 40 }),
    debt({ id: "card", name: "Card", balance: 1000, interestRate: 24, minimumPayment: 40, accountType: "credit_card" }),
  ],
  extraMonthly: 60,
  referenceDate: reference,
});
assert.equal(avalanche.avalanche.isReliable, true);
assert.equal(avalanche.snowball.isReliable, true);
assert.ok(avalanche.avalanche.totalInterest < avalanche.snowball.totalInterest);
assert.equal(avalanche.recommended, "avalanche");
assert.match(avalanche.recommendation, /easier to stick with/);
assert.equal(avalanche.avalanche.schedule[0].extraDebtId, "card");
assert.equal(avalanche.snowball.schedule[0].extraDebtId, "small");
assert.equal(avalanche.snowball.order[0].id, "small");
assert.ok(avalanche.interestSaved.avalanche > 0);
assert.ok(avalanche.interestSaved.snowball > 0);

const targeted = compareDebtStrategies({
  debts: [
    debt({ id: "high", name: "High", balance: 800, interestRate: 22, minimumPayment: 30 }),
    debt({ id: "low", name: "Low", balance: 400, interestRate: 6, minimumPayment: 30 }),
  ],
  extraMonthly: 0,
  sharedExtraByDebtId: { low: 40 },
  referenceDate: reference,
});
assert.equal(targeted.avalanche.schedule[0].lines.find((line) => line.debtId === "low").extraPayment, 40);
assert.equal(targeted.avalanche.schedule[0].lines.find((line) => line.debtId === "high").extraPayment, 0);
assert.equal(targeted.snowball.schedule[0].extraDebtId, "low");

const budgeted = projectDebtPayoff({
  debts: [
    debt({ id: "a", name: "A", balance: 200, interestRate: 12, minimumPayment: 20 }),
    debt({ id: "b", name: "B", balance: 200, interestRate: 18, minimumPayment: 20 }),
  ],
  strategy: "custom",
  customOrder: ["a", "b"],
  monthlyBudget: 40,
  extraByDebtId: { b: 25 },
  referenceDate: reference,
});
assert.equal(budgeted.monthlyCommitment, 65);
assert.equal(budgeted.schedule[0].lines.find((line) => line.debtId === "b").extraPayment, 25);
assert.equal(budgeted.schedule[0].lines.find((line) => line.debtId === "a").minimumPayment, 20);

const tied = projectDebtPayoff({
  debts: [
    debt({ id: "low", name: "Low", balance: 200, interestRate: 10, minimumPayment: 20 }),
    debt({ id: "high", name: "High", balance: 200, interestRate: 20, minimumPayment: 20 }),
  ],
  strategy: "snowball",
  extraMonthly: 30,
  referenceDate: reference,
});
assert.equal(tied.schedule[0].extraDebtId, "high");

const custom = projectDebtPayoff({
  debts: [
    debt({ id: "a", name: "A", balance: 300, interestRate: 20, minimumPayment: 25 }),
    debt({ id: "b", name: "B", balance: 120, interestRate: 4, minimumPayment: 25 }),
  ],
  strategy: "custom",
  customOrder: ["b", "a"],
  extraByDebtId: { b: 20 },
  referenceDate: reference,
});
assert.equal(custom.order[0].id, "b");
assert.equal(custom.schedule[0].lines.find((line) => line.debtId === "b").extraPayment > 0, true);

const spill = projectDebtPayoff({
  debts: [
    debt({ id: "a", name: "A", balance: 40, minimumPayment: 25 }),
    debt({ id: "b", name: "B", balance: 100, minimumPayment: 25 }),
  ],
  strategy: "snowball",
  extraMonthly: 80,
  referenceDate: reference,
});
assert.equal(spill.months, 2);
assert.equal(spill.totalPaid, 140);
assert.equal(spill.schedule[0].lines.find((line) => line.debtId === "a").endingBalance, 0);
assert.equal(spill.schedule[0].lines.find((line) => line.debtId === "b").endingBalance, 10);

const buried = projectDebtPayoff({
  debts: [
    debt({ id: "paid", name: "Paid", balance: 0, minimumPayment: 80 }),
    debt({ id: "open", name: "Open", balance: 90, minimumPayment: 30 }),
  ],
  strategy: "avalanche",
  referenceDate: reference,
});
assert.equal(buried.months, 3);
assert.equal(buried.order.length, 1);

assert.equal(
  debtDoesNotAmortize(debt({ id: "stuck", name: "Stuck", balance: 1000, interestRate: 24, minimumPayment: 10 })),
  true,
);
const incomplete = projectDebtPayoff({
  debts: [debt({ id: "stuck", name: "Stuck", balance: 1000, interestRate: 24, minimumPayment: 10 })],
  strategy: "avalanche",
  referenceDate: reference,
});
assert.equal(incomplete.isReliable, false);
assert.equal(incomplete.debtFreeDate, null);
assert.equal(incomplete.totalInterest, null);
assert.match(incomplete.incompleteReason, /Forecast incomplete/);

assert.equal(weightedAverageApr([
  debt({ id: "a", name: "A", balance: 100, interestRate: 10, minimumPayment: 10 }),
  debt({ id: "b", name: "B", balance: 300, interestRate: 20, minimumPayment: 10 }),
]), 17.5);

assert.equal(monthlyAmountFromSchedule(50, "weekly"), 216.67);
assert.equal(monthlyAmountFromSchedule(50, "biweekly"), 108.33);
assert.equal(monthlyAmountFromSchedule(50, "twice_monthly"), 100);
assert.equal(monthlyAmountFromSchedule(50, "monthly"), 50);

const kept = incomePlanAllocationsWithExtraDebt(
  [
    {
      name: "House",
      icon: "🏠",
      amount: 200,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: "goal-1",
      monthlyTarget: null,
      sortOrder: 0,
    },
    {
      name: EXTRA_DEBT_ALLOCATION_NAME,
      icon: "💳",
      amount: 25,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      debtId: "old",
      monthlyTarget: null,
      sortOrder: 1,
    },
  ],
  { amount: 40, debtId: "card" },
);
assert.equal(kept.length, 2);
assert.equal(kept[0].goalId, "goal-1");
assert.equal(kept[0].amount, 200);
assert.equal(kept[1].debtId, "card");
assert.equal(kept[1].amount, 40);
assert.equal(
  incomePlanAllocationsWithExtraDebt(kept, { amount: 0, debtId: "card" }).some(
    (allocation) => allocation.name === EXTRA_DEBT_ALLOCATION_NAME,
  ),
  false,
);

const plan = {
  id: "plan",
  paySchedule: "biweekly",
  paycheckAmount: 880.66,
  anchorDate: "2026-01-02",
  weeklyDayOfWeek: null,
  monthlyDays: [],
  customIntervalDays: null,
  depositAccountId: "checking",
  nextPayDate: "2026-10-16",
  lastProcessedDate: null,
  isActive: true,
  allocations: [
    {
      id: "extra",
      name: EXTRA_DEBT_ALLOCATION_NAME,
      icon: "💳",
      amount: 50,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      debtId: "card",
      monthlyTarget: null,
      sortOrder: 0,
    },
  ],
};
assert.equal(plannedExtraDebtMonthly(plan), 108.33);

const finance = {
  ...emptyFinanceData,
  accounts: [
    {
      id: "checking",
      name: "Checking",
      institution: "Bank",
      type: "checking",
      balance: 2000,
      monthlyChange: 0,
      includeInSafeToSpend: true,
    },
  ],
  income: [
    {
      id: "salary",
      name: "Salary",
      amount: 5000,
      frequency: "monthly",
      category: "Employment",
      schedule: {
        frequency: "monthly",
        startDate: "2026-01-01",
        nextOccurrence: "2026-10-30",
        status: "active",
      },
    },
  ],
  debts: [
    {
      id: "card",
      name: "Card",
      balance: 1000,
      originalBalance: 1000,
      interestRate: 20,
      minimumPayment: 100,
      monthlyChange: 0,
      dueDay: 20,
      accountType: "credit_card",
    },
  ],
  incomePlan: plan,
};
const flow = calculateMoneyFlow(finance, reference);
assert.equal(flow.debts, 208.33);
const outlook = forecastCashOutlook(finance, reference);
const minimumEvents = outlook.events.filter((event) => event.id.startsWith("debt-card-"));
const extraEvents = outlook.events.filter((event) => event.id.startsWith("debt-plan-"));
assert.ok(minimumEvents.length > 0);
assert.ok(extraEvents.length > 0);
assert.ok(minimumEvents.every((event) => event.amount === -100));
assert.ok(extraEvents.every((event) => event.amount === -50));

const legacy = forecastCashOutlook(
  {
    ...finance,
    incomePlan: {
      ...plan,
      allocations: [{ ...plan.allocations[0], name: "Card payment" }],
    },
  },
  reference,
);
assert.equal(legacy.events.some((event) => event.id.startsWith("debt-plan-")), false);
assert.ok(legacy.events.some((event) => event.amount === -100));

const recommendations = buildDebtRecommendations({
  debts: finance.debts,
  comparison: compareDebtStrategies({ debts: finance.debts, referenceDate: reference }),
  extraMonthly: 300,
  safeToSpend: 40,
  monthlyIncome: 5000,
});
assert.ok(recommendations.some((item) => item.id === "cash-short"));
assert.ok(recommendations.some((item) => item.id === "extra-50"));

const simulated = simulateDebtPayoff(finance.debts, "avalanche", 0, reference);
assert.equal(simulated.isReliable, true);
assert.equal(simulated.months > 0, true);

const planner = readFileSync("components/debt/DebtPayoffPlanner.tsx", "utf8");
const screen = readFileSync("components/native/ios/IosDebtScreen.tsx", "utf8");
assert.match(planner, /Save strategy/);
assert.match(planner, /type="range"/);
assert.doesNotMatch(planner, /makeDebtPayment/);
assert.match(screen, /Payoff strategy/);
assert.match(screen, /Add payment plan/);
assert.match(screen, /DebtPayoffPlanner/);
assert.match(readFileSync("lib/finance/debts.ts", "utf8"), /Add payment plan/);

function paycheckFlow(payment) {
  return calculateMoneyFlow(
    {
      ...emptyFinanceData,
      accounts: [
        {
          id: "checking",
          name: "Checking",
          institution: "Bank",
          type: "checking",
          balance: 10_000,
          includeInSafeToSpend: true,
        },
      ],
      income: [
        {
          id: "job",
          name: "Job",
          amount: 3000,
          frequency: "monthly",
          category: "Employment",
          schedule: {
            frequency: "monthly",
            startDate: "2026-01-01",
            nextOccurrence: "2026-10-30",
            status: "active",
          },
        },
      ],
      debts: [
        debt({
          id: "med",
          name: "Medical",
          balance: 500,
          minimumPayment: 100,
          accountType: "medical",
        }),
      ],
      transactions: payment
        ? [
            {
              id: "pay",
              amount: payment,
              type: "expense",
              category: "Healthcare",
              accountId: "checking",
              date: "2026-10-04",
              notes: "Medical payment",
              debtId: "med",
            },
          ]
        : [],
    },
    reference,
  );
}

const unpaidDebt = paycheckFlow(0);
assert.equal(unpaidDebt.debts, 100);
assert.equal(unpaidDebt.safeToSpend, 2900);
const paidDebt = paycheckFlow(100);
assert.equal(paidDebt.bills, 0);
assert.equal(paidDebt.debts, 100);
assert.equal(paidDebt.safeToSpend, 2900);
const extraDebtPayment = paycheckFlow(150);
assert.equal(extraDebtPayment.debts, 150);
assert.equal(extraDebtPayment.safeToSpend, 2850);

console.log("debt payoff ok");
