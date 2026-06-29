import type { FinanceEvent, FinanceEventSurface, FinanceEventTone, FinanceEventType } from "@/lib/events/types";
import { inferDebtAccountType } from "@/lib/finance/debts";
import type { Bill, Debt, FinanceData } from "@/lib/finance/types";

export const emptyFinanceData: FinanceData = {
  accounts: [],
  bills: [],
  income: [],
  savingsGoals: [],
  debts: [],
  investments: [],
  transactions: [],
  events: [],
  incomePlan: null,
  incomePlanPaychecks: [],
};

const DEFAULT_EVENT_SURFACES: FinanceEventSurface[] = ["activity"];

function sanitizeFinanceEvent(
  event: Partial<FinanceEvent> | null | undefined,
): FinanceEvent | null {
  if (!event || typeof event.id !== "string") {
    return null;
  }

  return {
    id: event.id,
    type: (event.type ?? "activity_applied") as FinanceEventType,
    label: event.label ?? "Activity",
    description: event.description ?? "",
    icon: event.icon ?? "✓",
    tone: (event.tone ?? "neutral") as FinanceEventTone,
    surfaces: Array.isArray(event.surfaces)
      ? event.surfaces.filter(Boolean) as FinanceEventSurface[]
      : DEFAULT_EVENT_SURFACES,
    entityId: event.entityId,
    entityType: event.entityType,
    amount: event.amount,
    timestamp: event.timestamp ?? new Date().toISOString(),
    read: event.read ?? false,
  };
}

function normalizeBill(bill: Bill): Bill {
  return {
    ...bill,
    paycheckAssignment: bill.paycheckAssignment ?? "first_paycheck",
    customPayDay: bill.customPayDay ?? null,
    paymentAccountId: bill.paymentAccountId ?? null,
    splits: bill.splits ?? [],
  };
}

function normalizeDebt(debt: Debt): Debt {
  return {
    ...debt,
    originalBalance: debt.originalBalance ?? debt.balance,
    dueDay: debt.dueDay ?? 1,
    accountType: debt.accountType ?? inferDebtAccountType(debt.name),
  };
}

export function coerceFinanceData(
  data: Partial<FinanceData> | FinanceData | null | undefined,
): FinanceData {
  if (!data) {
    return emptyFinanceData;
  }

  const events = (data.events ?? [])
    .map((event) => sanitizeFinanceEvent(event))
    .filter((event): event is FinanceEvent => event !== null);

  return {
    accounts: data.accounts ?? [],
    bills: (data.bills ?? []).map(normalizeBill),
    income: data.income ?? [],
    savingsGoals: data.savingsGoals ?? [],
    debts: (data.debts ?? []).map(normalizeDebt),
    investments: data.investments ?? [],
    transactions: data.transactions ?? [],
    events,
    incomePlan: data.incomePlan ?? null,
    incomePlanPaychecks: data.incomePlanPaychecks ?? [],
  };
}
