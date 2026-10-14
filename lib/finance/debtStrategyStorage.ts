import type { PayoffStrategyKind } from "@/lib/finance/debtPayoff";

const STORAGE_PREFIX = "buxme.debt-strategy.";

export type SavedDebtStrategy = {
  strategy: PayoffStrategyKind;
  extraMonthly: number;
  customOrder: string[];
  extraByDebtId: Record<string, number>;
  monthlyBudget: number | null;
};

function emptyStrategy(): SavedDebtStrategy {
  return {
    strategy: "avalanche",
    extraMonthly: 0,
    customOrder: [],
    extraByDebtId: {},
    monthlyBudget: null,
  };
}

export function readSavedDebtStrategy(userId: string | null): SavedDebtStrategy | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SavedDebtStrategy>;
    const strategy =
      parsed.strategy === "snowball" || parsed.strategy === "custom"
        ? parsed.strategy
        : "avalanche";
    const extraByDebtId: Record<string, number> = {};
    if (parsed.extraByDebtId && typeof parsed.extraByDebtId === "object") {
      for (const [id, value] of Object.entries(parsed.extraByDebtId)) {
        const amount = Number(value);
        if (Number.isFinite(amount) && amount > 0) {
          extraByDebtId[id] = Math.round(amount * 100) / 100;
        }
      }
    }
    return {
      ...emptyStrategy(),
      strategy,
      extraMonthly: Math.max(0, Number(parsed.extraMonthly) || 0),
      customOrder: Array.isArray(parsed.customOrder)
        ? parsed.customOrder.filter((id): id is string => typeof id === "string")
        : [],
      extraByDebtId,
      monthlyBudget:
        parsed.monthlyBudget == null || parsed.monthlyBudget === ("" as unknown)
          ? null
          : Math.max(0, Number(parsed.monthlyBudget) || 0),
    };
  } catch {
    return null;
  }
}

export function writeSavedDebtStrategy(
  userId: string | null,
  strategy: SavedDebtStrategy,
): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  window.localStorage.setItem(
    `${STORAGE_PREFIX}${userId}`,
    JSON.stringify({
      strategy: strategy.strategy,
      extraMonthly: strategy.extraMonthly,
      customOrder: strategy.customOrder,
      extraByDebtId: strategy.extraByDebtId,
      monthlyBudget: strategy.monthlyBudget,
    }),
  );
}
