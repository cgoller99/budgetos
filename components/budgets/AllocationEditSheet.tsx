"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { useFinance } from "@/context/FinanceContext";
import {
  eligibleLinkAccounts,
  formatBankAccountLabel,
} from "@/lib/budgets/accountDisplay";
import { formatCurrency } from "@/lib/finance/format";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlanAllocation } from "@/lib/incomePlan/types";
import { triggerHaptic } from "@/lib/native/haptics";

export type AllocationEditTarget = {
  allocationId: string;
};

type AllocationEditSheetProps = {
  target: AllocationEditTarget | null;
  onClose: () => void;
  /** When true, open focused on the full plan (first allocation). */
  editAll?: boolean;
};

type Draft = {
  name: string;
  amount: string;
  accountId: string;
  goalId: string;
};

function allocationToDraft(allocation: IncomePlanAllocation): Draft {
  return {
    name: allocation.name,
    amount:
      allocation.amount != null && Number.isFinite(allocation.amount)
        ? String(allocation.amount)
        : "",
    accountId: allocation.accountId ?? "",
    goalId: allocation.goalId ?? "",
  };
}

export function AllocationEditSheet({
  target,
  onClose,
  editAll = false,
}: AllocationEditSheetProps) {
  const finance = useFinance();
  const plan = useMemo(
    () => filterPersonalIncomePlan(finance.incomePlan, finance.viewerUserId ?? null),
    [finance.incomePlan, finance.viewerUserId],
  );
  const open = Boolean(target) || editAll;
  const initialAllocation = useMemo(() => {
    if (!plan) return null;
    if (target?.allocationId) {
      return plan.allocations.find((item) => item.id === target.allocationId) ?? null;
    }
    if (editAll) return plan.allocations[0] ?? null;
    return null;
  }, [editAll, plan, target]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    if (!open || !initialAllocation) {
      setActiveId(null);
      setDraft(null);
      setConfirming(false);
      setError(null);
      return;
    }
    setActiveId(initialAllocation.id);
    setDraft(allocationToDraft(initialAllocation));
    setConfirming(false);
    setError(null);
  }, [initialAllocation, open]);

  const accounts = useMemo(
    () => eligibleLinkAccounts(finance.accounts),
    [finance.accounts],
  );
  const goals = finance.savingsGoals ?? [];

  const currentAllocation = useMemo(() => {
    if (!plan || !activeId) return null;
    return plan.allocations.find((item) => item.id === activeId) ?? null;
  }, [activeId, plan]);

  const parsedAmount = draft ? Number.parseFloat(draft.amount) : NaN;
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount >= 0;

  const overIncome = useMemo(() => {
    if (!plan || !draft || !currentAllocation || !amountOk) return false;
    if (currentAllocation.isRemainingBalance) return false;
    const nextAllocations = plan.allocations.map((allocation) => {
      if (allocation.id !== currentAllocation.id) return allocation;
      return {
        ...allocation,
        amount: parsedAmount,
        percentage: null,
        allocationType: "fixed" as const,
      };
    });
    const resolved = resolveAllocationAmounts({
      paycheckAmount: plan.paycheckAmount,
      allocations: nextAllocations,
    });
    const total = resolved.reduce((sum, item) => sum + item.amount, 0);
    return total > plan.paycheckAmount + 0.009;
  }, [amountOk, currentAllocation, draft, parsedAmount, plan]);

  const previousAccount = currentAllocation?.accountId
    ? accounts.find((account) => account.id === currentAllocation.accountId) ?? null
    : null;
  const nextAccount = draft?.accountId
    ? accounts.find((account) => account.id === draft.accountId) ?? null
    : null;
  const accountChanged =
    (currentAllocation?.accountId ?? "") !== (draft?.accountId || "");

  function selectAllocation(id: string) {
    if (!plan) return;
    const allocation = plan.allocations.find((item) => item.id === id);
    if (!allocation) return;
    setActiveId(id);
    setDraft(allocationToDraft(allocation));
    setConfirming(false);
    setError(null);
  }

  function requestSave() {
    if (!draft || !currentAllocation || !amountOk) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (accountChanged) {
      setConfirming(true);
      return;
    }
    void persist();
  }

  function persist() {
    if (!plan || !draft || !currentAllocation || !amountOk) return;
    setError(null);
    startSave(async () => {
      try {
        const allocations = plan.allocations.map((allocation) => {
          const { id: _id, ...rest } = allocation;
          if (allocation.id !== currentAllocation.id) return rest;
          return {
            ...rest,
            name: draft.name.trim(),
            amount: currentAllocation.isRemainingBalance ? null : parsedAmount,
            accountId: draft.accountId || null,
            goalId: draft.goalId || null,
            ...(currentAllocation.isRemainingBalance
              ? {}
              : { percentage: null, allocationType: "fixed" as const }),
          };
        });
        await finance.saveIncomePlan({
          paySchedule: plan.paySchedule,
          paycheckAmount: plan.paycheckAmount,
          anchorDate: plan.anchorDate,
          weeklyDayOfWeek: plan.weeklyDayOfWeek,
          monthlyDays: plan.monthlyDays,
          customIntervalDays: plan.customIntervalDays,
          depositAccountId: plan.depositAccountId,
          ...(plan.linkedIncomeSourceId
            ? { linkedIncomeSourceId: plan.linkedIncomeSourceId }
            : {}),
          allocations,
        });
        void triggerHaptic("success");
        setConfirming(false);
        onClose();
      } catch (saveError) {
        setConfirming(false);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save. Your previous budget was kept.",
        );
      }
    });
  }

  const title = confirming
    ? "Confirm bank account change"
    : editAll
      ? "Edit Budget"
      : "Edit allocation";

  return (
    <IosBottomSheet
      open={open && Boolean(draft) && Boolean(currentAllocation)}
      title={title}
      onClose={() => {
        if (isSaving) return;
        onClose();
      }}
      footer={
        confirming ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={isSaving}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={isSaving}
              onClick={() => void persist()}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={isSaving}
              onClick={requestSave}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )
      }
    >
      {draft && currentAllocation && plan ? (
        <div className="space-y-4 pb-2">
          {editAll && plan.allocations.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plan.allocations.map((allocation) => (
                <button
                  key={allocation.id}
                  type="button"
                  className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium ${
                    allocation.id === activeId
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white/[0.06] text-[var(--text-secondary)]"
                  }`}
                  onClick={() => selectAllocation(allocation.id)}
                >
                  {allocation.icon} {allocation.name}
                </button>
              ))}
            </div>
          ) : null}

          {confirming ? (
            <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 text-sm text-[var(--text-secondary)]">
              <p className="text-[var(--foreground)]">
                You are moving your{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(parsedAmount)}/paycheck
                </span>{" "}
                <span className="font-semibold">{draft.name.trim()}</span> allocation
                from{" "}
                <span className="font-semibold">
                  {previousAccount
                    ? formatBankAccountLabel(previousAccount)
                    : "No bank account"}
                </span>{" "}
                to{" "}
                <span className="font-semibold">
                  {nextAccount
                    ? formatBankAccountLabel(nextAccount)
                    : "No bank account"}
                </span>
                .
              </p>
              <p>
                This only updates your budget plan. It does not move real money or change
                bank balances.
              </p>
            </div>
          ) : (
            <>
              <label className="block text-xs text-[var(--text-muted)]">
                Name
                <Input
                  className="mt-1 min-h-11"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  aria-label="Allocation name"
                />
              </label>

              <label className="block text-xs text-[var(--text-muted)]">
                Amount per paycheck
                <Input
                  className="mt-1 min-h-11"
                  inputMode="decimal"
                  disabled={currentAllocation.isRemainingBalance}
                  value={
                    currentAllocation.isRemainingBalance
                      ? "Remaining balance"
                      : draft.amount
                  }
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, amount: event.target.value } : current,
                    )
                  }
                  aria-label="Amount per paycheck"
                />
              </label>
              {overIncome ? (
                <p className="text-sm text-[var(--warning)]" role="status">
                  This amount would push planned allocations over your{" "}
                  {formatCurrency(plan.paycheckAmount)} paycheck.
                </p>
              ) : null}

              <fieldset className="space-y-2">
                <legend className="text-xs text-[var(--text-muted)]">Bank account</legend>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Planning link only — choosing an account does not transfer money.
                </p>
                <div className="space-y-2 rounded-2xl border border-white/[0.08] p-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="budget-bank-account"
                      className="size-4 accent-[var(--accent)]"
                      checked={!draft.accountId}
                      onChange={() =>
                        setDraft((current) =>
                          current ? { ...current, accountId: "" } : current,
                        )
                      }
                    />
                    <span className="text-sm text-[var(--foreground)]">No bank account</span>
                  </label>
                  {accounts.map((account) => {
                    const selected = draft.accountId === account.id;
                    return (
                      <label
                        key={account.id}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04] ${
                          selected ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/40" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="budget-bank-account"
                          className="mt-1 size-4 accent-[var(--accent)]"
                          checked={selected}
                          onChange={() =>
                            setDraft((current) =>
                              current
                                ? { ...current, accountId: account.id }
                                : current,
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[var(--foreground)]">
                            {formatBankAccountLabel(account)}
                            {selected ? " · Current" : ""}
                          </span>
                          <span className="block text-xs tabular-nums text-[var(--text-muted)]">
                            {formatCurrency(account.balance)} actual
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block text-xs text-[var(--text-muted)]">
                Savings goal (optional)
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
                  value={draft.goalId}
                  aria-label="Savings goal"
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, goalId: event.target.value }
                        : current,
                    )
                  }
                >
                  <option value="">None</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                Purpose stays tied to this allocation name and goal. Shared bank accounts
                still show one combined balance in Future Balances.
              </p>
            </>
          )}

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </IosBottomSheet>
  );
}
