import type { IncomeSource } from "@/lib/finance/types";

export type IncomePlanLinkResolution =
  | {
      status: "linked";
      incomeSourceId: string;
      reason: "explicit" | "preserved" | "singleton";
    }
  | {
      status: "unlinked";
      incomeSourceId: null;
      reason: "none" | "ambiguous" | "missing_preserved" | "invalid_explicit";
    };

function isActiveIncomeSource(source: IncomeSource): boolean {
  return source.schedule?.status !== "paused";
}

function activeIncomeSources(
  incomeSources: IncomeSource[] | null | undefined,
): IncomeSource[] {
  return (incomeSources ?? []).filter(isActiveIncomeSource);
}

/**
 * Resolve which income source an Income Plan should own.
 *
 * Rules (stable IDs only — never name or amount matching):
 * 1. Explicit selection wins when the id still exists.
 * 2. Preserve an existing link while that source remains active.
 * 3. Exactly one active income source → deterministic singleton link.
 * 4. Zero sources → unlinked (plan may project alone).
 * 5. Two or more sources without an explicit/preserved link → ambiguous;
 *    leave unlinked rather than silently merging unrelated jobs.
 */
export function resolveIncomePlanLinkedSourceId(options: {
  incomeSources: IncomeSource[] | null | undefined;
  existingLinkedIncomeSourceId?: string | null;
  /** When provided (including null), caller is making an explicit choice. */
  explicitLinkedIncomeSourceId?: string | null;
}): IncomePlanLinkResolution {
  const active = activeIncomeSources(options.incomeSources);
  const activeIds = new Set(active.map((source) => source.id));

  if (options.explicitLinkedIncomeSourceId !== undefined) {
    const explicit = options.explicitLinkedIncomeSourceId;
    if (explicit === null) {
      return { status: "unlinked", incomeSourceId: null, reason: "none" };
    }
    if (activeIds.has(explicit)) {
      return {
        status: "linked",
        incomeSourceId: explicit,
        reason: "explicit",
      };
    }
    return {
      status: "unlinked",
      incomeSourceId: null,
      reason: "invalid_explicit",
    };
  }

  const existing = options.existingLinkedIncomeSourceId ?? null;
  if (existing) {
    if (activeIds.has(existing)) {
      return {
        status: "linked",
        incomeSourceId: existing,
        reason: "preserved",
      };
    }
    return {
      status: "unlinked",
      incomeSourceId: null,
      reason: "missing_preserved",
    };
  }

  if (active.length === 1) {
    return {
      status: "linked",
      incomeSourceId: active[0].id,
      reason: "singleton",
    };
  }

  if (active.length === 0) {
    return { status: "unlinked", incomeSourceId: null, reason: "none" };
  }

  return { status: "unlinked", incomeSourceId: null, reason: "ambiguous" };
}

/**
 * Safe, non-destructive remediation candidate filter.
 * Only auto-backfill when the user has exactly one active income source.
 * Never guess among multiple jobs.
 */
export function isSafeIncomePlanLinkBackfillCandidate(options: {
  linkedIncomeSourceId?: string | null;
  incomeSources: IncomeSource[] | null | undefined;
}): boolean {
  if (options.linkedIncomeSourceId) {
    return false;
  }
  return activeIncomeSources(options.incomeSources).length === 1;
}
