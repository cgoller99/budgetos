/**
 * Goal ↔ account linking helpers.
 *
 * Progress sources (kept distinct):
 * 1. Account balance — live (or stale snapshot) eligible balance on the linked account
 * 2. Amount assigned to the goal — full eligible or partial allocation
 * 3. Confirmed contributions — goal.current / contribution transactions (ledger)
 * 4. Planned contributions — Income Plan / auto schedule (not completed transfers)
 * 5. Projected future amount — forecast from planned weekly rate
 *
 * Linking never invents transactions or moves money.
 */
import type { Account, AccountType, FinanceData, SavingsGoal } from "@/lib/finance/types";

export type GoalLinkMode = "full" | "partial";

export type GoalAccountLink = {
  accountId: string;
  mode: GoalLinkMode;
  /** Required when mode === "partial"; ignored for full. */
  allocatedAmount: number | null;
};

export type LinkableAccountType = Extract<
  AccountType,
  "checking" | "savings" | "investment" | "cash"
>;

const LINKABLE_TYPES = new Set<AccountType>([
  "checking",
  "savings",
  "investment",
  "cash",
]);

/** Stale if never synced, or last sync older than this. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isLinkableAccount(account: Account): boolean {
  if (account.archivedAt || account.isHidden) {
    return false;
  }
  return LINKABLE_TYPES.has(account.type);
}

export type EligibleBalanceAccount = {
  type: string;
  balance: number;
  availableBalance?: number | null;
};

export function eligibleAccountBalance(account: EligibleBalanceAccount): number {
  if (account.type === "investment") {
    return roundCurrency(Math.max(0, account.balance));
  }
  const available =
    account.availableBalance != null && Number.isFinite(account.availableBalance)
      ? account.availableBalance
      : account.balance;
  return roundCurrency(Math.max(0, available));
}

export function isAccountLinkStale(
  account: Account | null | undefined,
  snapshotAt?: string | null,
  referenceDate = new Date(),
): boolean {
  if (!account) {
    return true;
  }

  if (account.isPlaidLinked) {
    if (!account.bankConnectionId) {
      return true;
    }
    if (!account.lastSyncedAt) {
      return true;
    }
    const synced = new Date(account.lastSyncedAt).getTime();
    if (!Number.isFinite(synced)) {
      return true;
    }
    return referenceDate.getTime() - synced > STALE_AFTER_MS;
  }

  // Manual accounts: snapshot older than a week is treated as stale for display.
  if (snapshotAt) {
    const snap = new Date(snapshotAt).getTime();
    if (Number.isFinite(snap) && referenceDate.getTime() - snap > STALE_AFTER_MS) {
      return true;
    }
  }

  return false;
}

export function findLinkedAccount(
  data: FinanceData,
  goal: SavingsGoal,
): Account | null {
  const accountId = goal.accountLink?.accountId;
  if (!accountId) {
    return null;
  }
  return data.accounts.find((account) => account.id === accountId) ?? null;
}

/**
 * How much of an account is already assigned to other goals (excluding `exceptGoalId`).
 * Full-mode goals claim the entire remaining eligible balance (treated as exclusive).
 */
export function assignedAmountOnAccount(
  data: FinanceData,
  accountId: string,
  exceptGoalId?: string,
): { totalAssigned: number; hasFullClaim: boolean; goalIds: string[] } {
  let totalAssigned = 0;
  let hasFullClaim = false;
  const goalIds: string[] = [];

  for (const goal of data.savingsGoals) {
    if (goal.id === exceptGoalId) continue;
    const link = goal.accountLink;
    if (!link || link.accountId !== accountId) continue;

    goalIds.push(goal.id);
    if (link.mode === "full") {
      hasFullClaim = true;
    } else if (link.mode === "partial" && link.allocatedAmount != null) {
      totalAssigned = roundCurrency(totalAssigned + Math.max(0, link.allocatedAmount));
    }
  }

  return { totalAssigned, hasFullClaim, goalIds };
}

export type LinkValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateGoalAccountLink(
  data: FinanceData,
  goalId: string,
  link: GoalAccountLink | null,
): LinkValidation {
  if (!link) {
    return { ok: true };
  }

  const account = data.accounts.find((item) => item.id === link.accountId);
  if (!account) {
    return { ok: false, reason: "Choose an account that still exists." };
  }
  if (!isLinkableAccount(account)) {
    return {
      ok: false,
      reason: "Only checking, savings, cash, or investment accounts can be linked.",
    };
  }

  const eligible = eligibleAccountBalance(account);
  const others = assignedAmountOnAccount(data, link.accountId, goalId);

  if (others.hasFullClaim) {
    return {
      ok: false,
      reason:
        "Another goal already claims the remaining balance of this account. Switch that goal to a fixed allocation first.",
    };
  }

  if (link.mode === "full") {
    // Full = remaining unallocated after other partials. Allowed alongside partials.
    const remaining = roundCurrency(Math.max(0, eligible - others.totalAssigned));
    if (remaining <= 0) {
      return {
        ok: false,
        reason:
          "Nothing left unallocated on this account. Reduce other goal allocations first.",
      };
    }
    return { ok: true };
  }

  const allocated = roundCurrency(Math.max(0, link.allocatedAmount ?? 0));
  if (allocated <= 0) {
    return { ok: false, reason: "Enter a positive amount for partial tracking." };
  }
  if (roundCurrency(others.totalAssigned + allocated) > eligible + 0.009) {
    const remaining = roundCurrency(Math.max(0, eligible - others.totalAssigned));
    return {
      ok: false,
      reason: `Only ${remaining.toFixed(2)} remains unassigned on this account. Reduce the allocation or unlink other goals.`,
    };
  }

  return { ok: true };
}

export type GoalProgressAmounts = {
  /** Live or stale eligible account balance (null if unlinked). */
  accountBalance: number | null;
  /** Dollars of the account assigned to this goal (null if unlinked). */
  assignedToGoal: number | null;
  /** Confirmed contribution ledger (goal.current). */
  confirmedContributions: number;
  /** Whether the linked balance is stale / disconnected. */
  linkStale: boolean;
  /** Balance used for % complete / remaining when linked; else confirmed. */
  trackedAmount: number;
  /** Investment-only: market change estimate when contributions are known. */
  marketChangeEstimate: number | null;
  lastRefreshedAt: string | null;
  linkMode: GoalLinkMode | null;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
};

/**
 * Resolve display progress without mutating the contribution ledger.
 * Linked progress uses assigned account dollars; confirmed contributions stay separate.
 */
export function resolveGoalProgressAmounts(
  data: FinanceData,
  goal: SavingsGoal,
  referenceDate = new Date(),
): GoalProgressAmounts {
  const confirmedContributions = roundCurrency(Math.max(0, goal.current));
  const link = goal.accountLink;

  if (!link) {
    return {
      accountBalance: null,
      assignedToGoal: null,
      confirmedContributions,
      linkStale: false,
      trackedAmount: confirmedContributions,
      marketChangeEstimate: null,
      lastRefreshedAt: null,
      linkMode: null,
      linkedAccountId: null,
      linkedAccountName: null,
    };
  }

  const account = findLinkedAccount(data, goal);
  const stale = isAccountLinkStale(account, goal.linkedSnapshotAt, referenceDate);
  const liveEligible = account ? eligibleAccountBalance(account) : null;
  const snapshot = goal.linkedSnapshotBalance;
  const accountBalance =
    !stale && liveEligible != null
      ? liveEligible
      : snapshot != null
        ? roundCurrency(Math.max(0, snapshot))
        : liveEligible;

  let assignedToGoal: number | null = null;
  if (accountBalance != null) {
    if (link.mode === "full") {
      // Remaining unallocated after other partial links on this account.
      const others = assignedAmountOnAccount(data, link.accountId, goal.id);
      assignedToGoal = roundCurrency(
        Math.max(0, accountBalance - others.totalAssigned),
      );
    } else {
      assignedToGoal = roundCurrency(
        Math.min(Math.max(0, link.allocatedAmount ?? 0), accountBalance),
      );
    }
  }

  const trackedAmount =
    assignedToGoal != null ? assignedToGoal : confirmedContributions;

  let marketChangeEstimate: number | null = null;
  if (account?.type === "investment" && assignedToGoal != null) {
    // Market change ≈ assigned balance − confirmed contributions (never treated as paycheck).
    marketChangeEstimate = roundCurrency(assignedToGoal - confirmedContributions);
  }

  const lastRefreshedAt =
    !stale && account?.lastSyncedAt
      ? account.lastSyncedAt
      : goal.linkedSnapshotAt ?? account?.lastSyncedAt ?? null;

  return {
    accountBalance,
    assignedToGoal,
    confirmedContributions,
    linkStale: stale || !account,
    trackedAmount,
    marketChangeEstimate,
    lastRefreshedAt,
    linkMode: link.mode,
    linkedAccountId: link.accountId,
    linkedAccountName: account?.nickname || account?.name || null,
  };
}

/** Snapshot fields to persist when a live account is healthy. */
export function snapshotFieldsForLink(account: Account | null): {
  linked_snapshot_balance: number | null;
  linked_snapshot_at: string | null;
} {
  if (!account) {
    return { linked_snapshot_balance: null, linked_snapshot_at: null };
  }
  return {
    linked_snapshot_balance: eligibleAccountBalance(account),
    linked_snapshot_at: new Date().toISOString(),
  };
}

export function linkableAccounts(data: FinanceData): Account[] {
  return data.accounts
    .filter(isLinkableAccount)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type AccountGoalShare = {
  goalId: string;
  goalName: string;
  mode: GoalLinkMode;
  /** Dollars of the account assigned to this goal (capped by eligible balance). */
  amount: number;
};

export type AccountShareSummary = {
  accountId: string;
  /** Eligible account balance (available for checking/savings; balance for investment). */
  totalBalance: number;
  /** Sum of dollars assigned to goals — never exceeds totalBalance. */
  allocated: number;
  /** totalBalance − allocated. */
  unallocated: number;
  shares: AccountGoalShare[];
  hasFullClaim: boolean;
};

/**
 * Allocated / unallocated / total for an account shared across goals.
 * Full-mode goals claim the remaining unallocated dollars after partials
 * (exclusive of other full claims — validated separately).
 */
export function summarizeAccountGoalShares(
  data: FinanceData,
  accountId: string,
  options?: {
    exceptGoalId?: string;
    /** Pending link for the editing goal (preview before save). */
    pending?: GoalAccountLink | null;
  },
): AccountShareSummary {
  const account = data.accounts.find((item) => item.id === accountId) ?? null;
  const totalBalance = account ? eligibleAccountBalance(account) : 0;
  const shares: AccountGoalShare[] = [];
  let partialTotal = 0;
  let hasFullClaim = false;
  let fullGoal: { goalId: string; goalName: string } | null = null;

  for (const goal of data.savingsGoals) {
    if (goal.id === options?.exceptGoalId) continue;
    const link = goal.accountLink;
    if (!link || link.accountId !== accountId) continue;

    if (link.mode === "full") {
      hasFullClaim = true;
      fullGoal = { goalId: goal.id, goalName: goal.name };
      continue;
    }

    const amount = roundCurrency(
      Math.min(Math.max(0, link.allocatedAmount ?? 0), totalBalance),
    );
    partialTotal = roundCurrency(partialTotal + amount);
    shares.push({
      goalId: goal.id,
      goalName: goal.name,
      mode: "partial",
      amount,
    });
  }

  if (options?.pending && options.pending.accountId === accountId) {
    if (options.pending.mode === "full") {
      hasFullClaim = true;
      fullGoal = {
        goalId: options.exceptGoalId ?? "pending",
        goalName: "This goal",
      };
    } else {
      const amount = roundCurrency(
        Math.min(Math.max(0, options.pending.allocatedAmount ?? 0), totalBalance),
      );
      partialTotal = roundCurrency(partialTotal + amount);
      shares.push({
        goalId: options.exceptGoalId ?? "pending",
        goalName: "This goal",
        mode: "partial",
        amount,
      });
    }
  }

  if (fullGoal) {
    const remaining = roundCurrency(Math.max(0, totalBalance - partialTotal));
    shares.push({
      goalId: fullGoal.goalId,
      goalName: fullGoal.goalName,
      mode: "full",
      amount: remaining,
    });
    partialTotal = roundCurrency(partialTotal + remaining);
  }

  const allocated = roundCurrency(Math.min(partialTotal, totalBalance));
  return {
    accountId,
    totalBalance,
    allocated,
    unallocated: roundCurrency(Math.max(0, totalBalance - allocated)),
    shares,
    hasFullClaim,
  };
}
