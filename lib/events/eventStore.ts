import { calculateNetWorth } from "@/lib/calculations/netWorth";
import { formatCurrency } from "@/lib/finance/format";
import { getBillsDueTomorrow } from "@/lib/finance/bills";
import type { FinanceData } from "@/lib/finance/types";
import { generateWeeklyPlan } from "@/lib/intelligence";
import type {
  FinanceEvent,
  FinanceEventSurface,
  FinanceEventTone,
  FinanceEventType,
} from "@/lib/events/types";

const MAX_EVENTS = 200;

type CreateEventInput = {
  type: FinanceEventType;
  label: string;
  description: string;
  icon: string;
  tone?: FinanceEventTone;
  surfaces?: FinanceEventSurface[];
  entityId?: string;
  entityType?: string;
  amount?: number;
  read?: boolean;
};

function createEvent(input: CreateEventInput): FinanceEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    label: input.label,
    description: input.description,
    icon: input.icon,
    tone: input.tone ?? "neutral",
    surfaces: input.surfaces ?? ["activity", "notification", "report"],
    entityId: input.entityId,
    entityType: input.entityType,
    amount: input.amount,
    timestamp: new Date().toISOString(),
    read: input.read ?? false,
  };
}

export function buildAccountAddedEvent(
  name: string,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "account_added",
    label: `+ Added ${name}`,
    description: "Account linked across Dashboard, Reports, and Money Flow.",
    icon: "🏦",
    tone: "positive",
    entityId,
    entityType: "account",
  });
}

export function buildBillAddedEvent(name: string, entityId: string): FinanceEvent {
  return createEvent({
    type: "bill_added",
    label: `+ Added ${name} Bill`,
    description: "Bill synced to Dashboard, Money Flow, and Safe To Spend.",
    icon: "📋",
    tone: "neutral",
    entityId,
    entityType: "bill",
  });
}

export function buildBillPaidEvent(
  name: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "bill_paid",
    label: `- Paid ${name} Bill`,
    description: "✓ Bill Paid — balances and Safe To Spend updated.",
    icon: "✓",
    tone: "negative",
    amount,
    entityId,
    entityType: "bill",
    surfaces: ["activity", "notification", "report"],
  });
}

export function buildIncomeAddedEvent(
  name: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "income_added",
    label: `+ Added ${name}`,
    description: "Income reflected in Money Flow, Safe To Spend, and Reports.",
    icon: "💵",
    tone: "positive",
    amount,
    entityId,
    entityType: "income",
  });
}

export function buildDebtAddedEvent(name: string, entityId: string): FinanceEvent {
  return createEvent({
    type: "debt_added",
    label: `+ Added ${name}`,
    description: "Debt synced to Dashboard, Money Flow, and your payoff plan.",
    icon: "💳",
    tone: "neutral",
    entityId,
    entityType: "debt",
  });
}

export function buildDebtPaymentEvent(
  name: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "debt_payment",
    label: `- Paid ${name}`,
    description: "✓ Debt payment applied — balance and Safe To Spend updated.",
    icon: "✓",
    tone: "positive",
    amount,
    entityId,
    entityType: "debt",
    surfaces: ["activity", "notification", "report"],
  });
}

export function buildGoalCreatedEvent(
  name: string,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "goal_created",
    label: `+ Created ${name} Goal`,
    description: "Goal added to Dashboard, Roadmap, and Financial Health.",
    icon: "🎯",
    tone: "positive",
    entityId,
    entityType: "goal",
    surfaces: ["activity", "notification", "report", "roadmap"],
  });
}

export function buildGoalContributionEvent(
  name: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "goal_contribution",
    label: `+ Added ${formatCurrency(amount)} to ${name}`,
    description: "Goal progress updated across Dashboard and Roadmap.",
    icon: "🎯",
    tone: "positive",
    amount,
    entityId,
    entityType: "goal",
    surfaces: ["activity", "notification", "report", "roadmap"],
  });
}

export function buildGoalCompletedEvent(
  name: string,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "goal_completed",
    label: `✓ ${name} Goal Completed`,
    description: "✓ Goal Completed — milestone reached on your Roadmap.",
    icon: "🏆",
    tone: "accent",
    entityId,
    entityType: "goal",
    surfaces: ["activity", "notification", "report", "roadmap"],
  });
}

export function buildTransactionAddedEvent(
  label: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "transaction_added",
    label,
    description: "Transaction applied to balances and Money Flow.",
    icon: "📝",
    tone: "neutral",
    amount,
    entityId,
    entityType: "transaction",
  });
}

export function buildPaycheckProcessedEvent(
  name: string,
  amount: number,
): FinanceEvent {
  return createEvent({
    type: "paycheck_processed",
    label: `+ ${name} Processed`,
    description: "✓ Paycheck Added — cash and Safe To Spend updated.",
    icon: "💵",
    tone: "positive",
    amount,
    surfaces: ["activity", "notification", "report"],
  });
}

export function buildActivityAppliedEvent(label: string): FinanceEvent {
  return createEvent({
    type: "activity_applied",
    label,
    description: "Recurring activity applied to your finances.",
    icon: "✓",
    tone: "positive",
    surfaces: ["activity", "notification"],
  });
}

export function buildNetWorthMilestoneEvent(threshold: number): FinanceEvent {
  return createEvent({
    type: "net_worth_milestone",
    label: `✓ Net Worth Milestone: ${formatCurrency(threshold)}`,
    description: "✓ New Net Worth Milestone reached.",
    icon: "💎",
    tone: "accent",
    amount: threshold,
    surfaces: ["activity", "notification", "report", "roadmap"],
  });
}

export function buildWeeklySummaryEvent(
  recommendationCount: number,
): FinanceEvent {
  return createEvent({
    type: "weekly_summary_ready",
    label: "✓ Weekly Summary Ready",
    description: `${recommendationCount} recommendations in This Week's Plan.`,
    icon: "📊",
    tone: "accent",
    surfaces: ["notification", "report"],
  });
}

export function buildBillDueTomorrowEvent(
  name: string,
  amount: number,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "bill_due_tomorrow",
    label: `${name} due tomorrow`,
    description: `${formatCurrency(amount)} due tomorrow — plan ahead in Bills.`,
    icon: "📋",
    tone: "accent",
    amount,
    entityId,
    entityType: "bill",
    surfaces: ["notification"],
    read: false,
  });
}

export function buildGoalReachedVirtualEvent(
  name: string,
  entityId: string,
): FinanceEvent {
  return createEvent({
    type: "goal_completed",
    label: `✓ ${name} Goal Reached`,
    description: "You've hit your savings target.",
    icon: "🏆",
    tone: "accent",
    entityId,
    entityType: "goal",
    surfaces: ["notification"],
    read: false,
  });
}

function getNextRoundThreshold(current: number): number {
  const thresholds = [
    1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
  ];

  return thresholds.find((threshold) => threshold > current) ?? 0;
}

export function deriveEvents(
  previous: FinanceData,
  next: FinanceData,
): FinanceEvent[] {
  const events: FinanceEvent[] = [];

  for (const goal of next.savingsGoals ?? []) {
    const before = (previous.savingsGoals ?? []).find((item) => item.id === goal.id);

    if (
      before &&
      before.current < before.target &&
      goal.current >= goal.target
    ) {
      events.push(buildGoalCompletedEvent(goal.name, goal.id));
    }
  }

  const previousNetWorth = calculateNetWorth(previous).value;
  const nextNetWorth = calculateNetWorth(next).value;
  const previousThreshold = getNextRoundThreshold(Math.max(previousNetWorth, 0));
  const nextThreshold = getNextRoundThreshold(Math.max(nextNetWorth, 0));

  if (
    previousThreshold > 0 &&
    nextThreshold > previousThreshold &&
    nextNetWorth >= previousThreshold
  ) {
    events.push(buildNetWorthMilestoneEvent(previousThreshold));
  }

  return events;
}

function isSameWeek(left: string, right: Date): boolean {
  const leftDate = new Date(left);
  const startOfWeek = new Date(right);
  startOfWeek.setDate(right.getDate() - right.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return leftDate >= startOfWeek && leftDate < endOfWeek;
}

export function deriveWeeklySummaryEvent(data: FinanceData): FinanceEvent | null {
  const plan = generateWeeklyPlan(data);

  if (plan.length === 0) {
    return null;
  }

  const alreadyEmitted = (data.events ?? []).some(
    (event) =>
      event.type === "weekly_summary_ready" &&
      isSameWeek(event.timestamp, new Date()),
  );

  if (alreadyEmitted) {
    return null;
  }

  return buildWeeklySummaryEvent(plan.length);
}

export function acknowledgeWeeklySummaryEvent(data: FinanceData): FinanceData {
  const plan = generateWeeklyPlan(data);

  if (plan.length === 0) {
    return data;
  }

  const now = new Date();
  const events = data.events ?? [];
  const existingIndex = events.findIndex(
    (event) =>
      event.type === "weekly_summary_ready" && isSameWeek(event.timestamp, now),
  );

  if (existingIndex >= 0) {
    const nextEvents = [...events];
    nextEvents[existingIndex] = { ...nextEvents[existingIndex], read: true };
    return { ...data, events: nextEvents };
  }

  return appendEvents(data, [
    { ...buildWeeklySummaryEvent(plan.length), read: true },
  ]);
}

function hasStoredNotificationForEntity(
  events: FinanceEvent[],
  entityId: string,
  types: FinanceEventType[],
): boolean {
  return events.some(
    (event) =>
      types.includes(event.type) &&
      event.entityId === entityId &&
      Array.isArray(event.surfaces) &&
      event.surfaces.includes("notification"),
  );
}

export function deriveBillDueTomorrowEvents(data: FinanceData): FinanceEvent[] {
  const referenceDate = new Date();
  const dueTomorrow = getBillsDueTomorrow(data, referenceDate);
  const events = data.events ?? [];

  return dueTomorrow
    .filter((bill) =>
      !hasStoredNotificationForEntity(events, bill.splitId, [
        "bill_due_tomorrow",
        "bill_paid",
      ])
    )
    .map((bill) => ({
      ...buildBillDueTomorrowEvent(bill.name, bill.remainingAmount, bill.splitId),
      id: `virtual-bill-due-${bill.splitId}`,
      timestamp: referenceDate.toISOString(),
    }));
}

export function deriveGoalReachedEvents(data: FinanceData): FinanceEvent[] {
  const goals = data.savingsGoals ?? [];
  const events = data.events ?? [];
  const referenceDate = new Date();

  return goals
    .filter(
      (goal) =>
        goal.target > 0 &&
        goal.current >= goal.target &&
        !hasStoredNotificationForEntity(events, goal.id, ["goal_completed"]),
    )
    .map((goal) => ({
      ...buildGoalReachedVirtualEvent(goal.name, goal.id),
      id: `virtual-goal-reached-${goal.id}`,
      timestamp: referenceDate.toISOString(),
    }));
}

export function appendEvents(
  data: FinanceData,
  events: FinanceEvent[],
): FinanceData {
  if (events.length === 0) {
    return data;
  }

  const merged = [...events, ...(data.events ?? [])].slice(0, MAX_EVENTS);

  return {
    ...data,
    events: merged,
  };
}

export function markEventRead(
  data: FinanceData,
  eventId: string,
): FinanceData {
  return {
    ...data,
    events: (data.events ?? []).map((event) =>
      event.id === eventId ? { ...event, read: true } : event,
    ),
  };
}

export function markAllEventsRead(data: FinanceData): FinanceData {
  return {
    ...data,
    events: (data.events ?? []).map((event) => ({ ...event, read: true })),
  };
}

export function deleteEvent(data: FinanceData, eventId: string): FinanceData {
  return {
    ...data,
    events: (data.events ?? []).filter((event) => event.id !== eventId),
  };
}

export function clearNotificationEvents(data: FinanceData): FinanceData {
  return {
    ...data,
    events: (data.events ?? []).filter(
      (event) => !Array.isArray(event.surfaces) || !event.surfaces.includes("notification"),
    ),
  };
}
