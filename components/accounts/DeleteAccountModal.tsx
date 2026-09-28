"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { PreferenceToggle } from "@/components/ui/PreferenceToggle";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  getAccountDisplayName,
  getAccountReferenceCounts,
  listPlaidConnectionMembers,
} from "@/lib/finance/accountPreferences";
import { formatCurrency } from "@/lib/finance/format";
import type { Account } from "@/lib/finance/types";

type DeleteAccountModalProps = {
  account: Account | null;
  onClose: () => void;
};

export function DeleteAccountModal({ account, onClose }: DeleteAccountModalProps) {
  const finance = useFinance();
  const { deleteAccount, disconnectPlaidAccount } = finance;
  const { showToast } = useToast();
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPlaidLinked = Boolean(account?.isPlaidLinked);
  const counts = account ? getAccountReferenceCounts(finance, account.id) : null;
  const connectionMembers = account
    ? listPlaidConnectionMembers({
        accounts: finance.accounts,
        debts: finance.debts,
        account,
      })
    : [];
  const removesWholeConnection = connectionMembers.length > 1;

  function handleClose() {
    setDeleteTransactions(false);
    onClose();
  }

  async function handleDeleteAccountOnly() {
    if (!account) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteAccount(account.id, { deleteTransactions: false });

      showToast({
        title: `✓ ${getAccountDisplayName(account)} Deleted`,
        subtitle: "✓ Dashboard Updated",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccountAndTransactions() {
    if (!account) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteAccount(account.id, { deleteTransactions: true });

      showToast({
        title: `✓ ${getAccountDisplayName(account)} Deleted`,
        subtitle: "✓ Account and linked transactions removed",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisconnectPlaid() {
    if (!account) {
      return;
    }

    setIsSubmitting(true);

    try {
      await disconnectPlaidAccount(account.id, {
        deleteTransactions,
      });

      showToast({
        title: `✓ ${account.institution || "Bank"} removed`,
        subtitle: deleteTransactions
          ? "Those accounts, balances, and imported transactions were removed."
          : "Sync stopped. Balances were removed. Imported transactions stay in history.",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayName = account ? getAccountDisplayName(account) : "";

  return (
    <Modal
      isOpen={account !== null}
      onClose={handleClose}
        title={isPlaidLinked ? "Remove bank account" : "Delete Account"}
    >
      <div className="space-y-5">
        {isPlaidLinked ? (
          <>
            <p className="text-sm leading-relaxed text-white/60">
              {removesWholeConnection
                ? `${displayName} shares one bank login with ${connectionMembers.length - 1} other account${connectionMembers.length - 1 === 1 ? "" : "s"}. Removing it stops sync for every account on that login.`
                : `This removes ${displayName} from Buxme and stops future syncs for this bank login.`}
            </p>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm text-white/70">
              <p className="font-medium text-white">What will be removed</p>
              <ul className="mt-2 space-y-1 text-white/55">
                {connectionMembers.map((member) => (
                  <li key={member.id}>
                    {member.name}
                    {member.kind === "debt" ? " (credit or loan)" : ""}
                    {" — balance leaves your dashboard"}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-white/55">
                {deleteTransactions
                  ? "Imported transactions and transfer history for these accounts will be deleted."
                  : "Imported transactions stay in your history. They are kept, but no longer attached to these accounts."}
              </p>
              <p className="mt-3 text-white/55">
                Buxme will not sync this bank again unless you connect it again.
              </p>
              {counts && (counts.bills > 0 || counts.incomeSources > 0) ? (
                <p className="mt-3 text-white/55">
                  Bills or income that use this account will lose that payment account.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
              <div>
                <p className="text-sm font-medium text-white">
                  Also delete imported transactions
                </p>
                <p className="mt-1 text-xs text-white/45">
                  Off by default. History stays unless you turn this on.
                </p>
              </div>
              <PreferenceToggle
                checked={deleteTransactions}
                onChange={setDeleteTransactions}
                label="Also delete imported transactions"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                fullWidth
                onClick={() => void handleDisconnectPlaid()}
                disabled={isSubmitting}
                className="bg-rose-500 hover:bg-rose-600"
              >
                {isSubmitting
                  ? "Removing..."
                  : removesWholeConnection
                    ? `Remove all ${connectionMembers.length} accounts`
                    : "Remove bank account"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-white/60">
              Are you sure you want to delete{" "}
              <span className="font-medium text-white">{displayName}</span>? This
              removes {formatCurrency(account?.balance ?? 0)} from your accounts
              and dashboard.
            </p>

            {counts && counts.transactions > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100/90">
                {counts.transactions} transaction
                {counts.transactions === 1 ? "" : "s"} linked to this account.
                You can delete the account only and keep transactions, or remove
                both.
              </div>
            )}

            {(counts?.bills ?? 0) > 0 || (counts?.incomeSources ?? 0) > 0 ? (
              <p className="text-xs text-white/45">
                {(counts?.bills ?? 0) > 0 &&
                  `${counts?.bills} bill${counts?.bills === 1 ? "" : "s"} use this account. `}
                {(counts?.incomeSources ?? 0) > 0 &&
                  `${counts?.incomeSources} income source${counts?.incomeSources === 1 ? "" : "s"} deposit here.`}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                fullWidth
                onClick={() => void handleDeleteAccountOnly()}
                disabled={isSubmitting}
                className="bg-rose-500/85 hover:bg-rose-500"
              >
                {isSubmitting ? "Deleting..." : "Delete Account Only"}
              </Button>
              {(counts?.transactions ?? 0) > 0 && (
                <Button
                  type="button"
                  fullWidth
                  onClick={() => void handleDeleteAccountAndTransactions()}
                  disabled={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  {isSubmitting
                    ? "Deleting..."
                    : "Delete Account + Transactions"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
