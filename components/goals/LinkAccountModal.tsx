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

  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<GoalLinkMode>("full");
  const [allocated, setAllocated] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goal) {
      setAccountId("");
      setMode("full");
      setAllocated("");
      setConfirmed(false);
      return;
    }
    setAccountId(goal.accountLink?.accountId ?? accounts[0]?.id ?? "");
    setMode(goal.accountLink?.mode ?? "full");
    setAllocated(
      goal.accountLink?.mode === "partial" && goal.accountLink.allocatedAmount != null
        ? String(goal.accountLink.allocatedAmount)
        : "",
    );
    setConfirmed(Boolean(goal.accountLink));
  }, [goal, accounts]);

  const selected = accounts.find((item) => item.id === accountId) ?? null;
  const eligible = selected ? eligibleAccountBalance(selected) : 0;

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
          "Progress can track the linked balance. Confirmed contributions were not overwritten.",
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
            Connect this goal to a real account by ID. Linking does not move money.
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

          {selected ? (
            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--text-secondary)]">
              <p>
                Latest eligible balance:{" "}
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(eligible)}
                </span>
              </p>
              <p className="mt-1">
                Last refreshed:{" "}
                {selected.lastSyncedAt
                  ? new Date(selected.lastSyncedAt).toLocaleString()
                  : "Manual / not synced"}
              </p>
            </div>
          ) : null}

          <FormField label="Tracking mode" htmlFor="goal-link-mode">
            <Select
              id="goal-link-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as GoalLinkMode)}
            >
              <option value="full">Entire eligible account balance</option>
              <option value="partial">Designated portion only</option>
            </Select>
          </FormField>

          {mode === "full" ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Withdrawals and investment market changes can move tracked progress up or down.
              Market gains are never counted as paycheck contributions.
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
                Total assigned across goals cannot exceed the eligible account balance (
                {formatCurrency(eligible)}).
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
              I understand this links progress to the account balance
              {mode === "full" ? " (full balance)" : ` (${formatCurrency(Number.parseFloat(allocated) || 0)} assigned)`}
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
