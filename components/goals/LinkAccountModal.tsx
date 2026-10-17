"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  eligibleAccountBalance,
  linkableAccounts,
  summarizeAccountGoalShares,
  validateGoalAccountLink,
} from "@/lib/finance/goalAccountLink";
import { formatCurrency } from "@/lib/finance/format";
import type { GoalLinkMode, SavingsGoal } from "@/lib/finance/types";

type LinkAccountModalProps = {
  goal: SavingsGoal | null;
  onClose: () => void;
};

export function LinkAccountModal({ goal, onClose }: LinkAccountModalProps) {
  const finance = useFinance();
  const { showToast } = useToast();
  const accounts = useMemo(() => linkableAccounts(finance), [finance]);

  // Default to partial so multiple goals can share one account.
  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<GoalLinkMode>("partial");
  const [allocated, setAllocated] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goal) {
      setAccountId("");
      setMode("partial");
      setAllocated("");
      setConfirmed(false);
      return;
    }
    setAccountId(goal.accountLink?.accountId ?? accounts[0]?.id ?? "");
    setMode(goal.accountLink?.mode ?? "partial");
    setAllocated(
      goal.accountLink?.mode === "partial" && goal.accountLink.allocatedAmount != null
        ? String(goal.accountLink.allocatedAmount)
        : goal.current > 0
          ? String(goal.current)
          : "",
    );
    setConfirmed(Boolean(goal.accountLink));
  }, [goal, accounts]);

  const selected = accounts.find((item) => item.id === accountId) ?? null;
  const allocatedNumber = Number.parseFloat(allocated) || 0;

  const sharePreview = useMemo(() => {
    if (!accountId || !goal) return null;
    return summarizeAccountGoalShares(finance, accountId, {
      exceptGoalId: goal.id,
      pending: {
        accountId,
        mode,
        allocatedAmount: mode === "partial" ? allocatedNumber : null,
      },
    });
  }, [accountId, allocatedNumber, finance, goal, mode]);

  async function handleUnlink() {
    if (!goal) return;
    setSaving(true);
    try {
      await finance.editGoal(goal.id, {
        name: goal.name,
        type: goal.type,
        target: goal.target,
        accountLink: null,
      });
      showToast({
        title: "Account unlinked",
        subtitle: "This goal is manually tracked again. Confirmed contributions were kept.",
      });
      onClose();
    } catch (error) {
      showToast({
        title: "Could not unlink",
        subtitle: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal || !accountId) return;

    const link = {
      accountId,
      mode,
      allocatedAmount:
        mode === "partial" ? Number.parseFloat(allocated) || 0 : null,
    };

    const validation = validateGoalAccountLink(finance, goal.id, link);
    if (!validation.ok) {
      showToast({ title: "Cannot link account", subtitle: validation.reason });
      return;
    }

    if (!confirmed) {
      showToast({
        title: "Confirm linking",
        subtitle: "Review what will happen, then check the confirmation box.",
      });
      return;
    }

    setSaving(true);
    try {
      await finance.editGoal(goal.id, {
        name: goal.name,
        type: goal.type,
        target: goal.target,
        accountLink: link,
      });
      showToast({
        title: "Account linked",
        subtitle:
          "Progress tracks the allocated balance. Confirmed contributions were not overwritten.",
      });
      onClose();
    } catch (error) {
      showToast({
        title: "Could not link account",
        subtitle: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(goal)} onClose={onClose} title="Link account">
      {goal ? (
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <p className="text-sm text-[var(--text-secondary)]">
            Link by account ID (manual, Plaid, or investment). Multiple goals can share one
            account — allocated dollars never overlap. Linking does not move money.
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Goal <span className="font-semibold text-[var(--foreground)]">{goal.name}</span>
            {" · "}
            Confirmed contributions stay at {formatCurrency(goal.current)}.
          </p>

          <FormField label="Account" htmlFor="goal-link-account">
            <Select
              id="goal-link-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
            >
              {accounts.length === 0 ? (
                <option value="">No linkable accounts</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.nickname || account.name}
                    {account.lastFour ? ` ···${account.lastFour}` : ""}
                    {` · ${account.type} · ${formatCurrency(eligibleAccountBalance(account))}`}
                    {account.isPlaidLinked ? " · Plaid" : " · Manual"}
                  </option>
                ))
              )}
            </Select>
          </FormField>

          {sharePreview ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-center text-sm">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total</p>
                <p className="mt-1 font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(sharePreview.totalBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Allocated</p>
                <p className="mt-1 font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(sharePreview.allocated)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Unallocated</p>
                <p className="mt-1 font-semibold tabular-nums text-[var(--accent-light)]">
                  {formatCurrency(sharePreview.unallocated)}
                </p>
              </div>
              {sharePreview.shares.length > 0 ? (
                <ul className="col-span-3 mt-1 space-y-1 border-t border-[var(--surface-border)] pt-2 text-left text-xs text-[var(--text-secondary)]">
                  {sharePreview.shares.map((share) => (
                    <li key={share.goalId} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{share.goalName}</span>
                      <span className="tabular-nums text-[var(--foreground)]">
                        {formatCurrency(share.amount)}
                        {share.mode === "full" ? " · remaining" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {selected?.lastSyncedAt ? (
                <p className="col-span-3 text-left text-xs text-[var(--text-muted)]">
                  Last refreshed {new Date(selected.lastSyncedAt).toLocaleString()}
                </p>
              ) : selected ? (
                <p className="col-span-3 text-left text-xs text-[var(--text-muted)]">
                  Manual account — balance updates when you edit it
                </p>
              ) : null}
            </div>
          ) : null}

          <FormField label="Tracking mode" htmlFor="goal-link-mode">
            <Select
              id="goal-link-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as GoalLinkMode)}
            >
              <option value="partial">Allocate a specific amount (shareable)</option>
              <option value="full">Entire remaining unallocated balance</option>
            </Select>
          </FormField>

          {mode === "full" ? (
            <p className="text-sm text-[var(--text-secondary)]">
              This goal claims whatever is left unallocated on the account. Other goals must use
              partial amounts. Withdrawals and market changes can move tracked progress. Market gains
              are never counted as paycheck contributions.
            </p>
          ) : (
            <FormField label="Amount assigned to this goal" htmlFor="goal-link-amount">
              <Input
                id="goal-link-amount"
                inputMode="decimal"
                value={allocated}
                onChange={(event) => setAllocated(event.target.value)}
                placeholder="0.00"
                required
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Unallocated available:{" "}
                {formatCurrency(
                  sharePreview
                    ? Math.max(
                        0,
                        sharePreview.totalBalance -
                          (sharePreview.allocated -
                            (Number.parseFloat(allocated) || 0)),
                      )
                    : 0,
                )}
                . Total assigned across goals cannot exceed the account balance.
              </p>
            </FormField>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-[var(--surface-border)] p-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I understand progress will track the linked allocation
              {mode === "full"
                ? " (remaining unallocated balance)"
                : ` (${formatCurrency(Number.parseFloat(allocated) || 0)} assigned)`}
              . Confirmed contributions ({formatCurrency(goal.current)}) stay in history and are not
              replaced. No money is transferred.
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" fullWidth disabled={saving || accounts.length === 0}>
              {saving ? "Saving…" : goal.accountLink ? "Update link" : "Link account"}
            </Button>
            {goal.accountLink ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={saving}
                onClick={() => void handleUnlink()}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="button" variant="ghost" fullWidth onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
