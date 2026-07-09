"use client";

import { useMemo, useState } from "react";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AddAccountModal } from "@/components/accounts/AddAccountModal";
import { DeleteAccountModal } from "@/components/accounts/DeleteAccountModal";
import { EditAccountModal } from "@/components/accounts/EditAccountModal";
import { BankSyncPlaceholder } from "@/components/accounts/BankSyncPlaceholder";
import { Button, EmptyState, PageHeader, SkeletonGrid } from "@/components/ui";
import { PreferenceToggle } from "@/components/ui/PreferenceToggle";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { isAccountVisible } from "@/lib/finance/accountPreferences";
import { cn } from "@/components/ui/cn";

export function AccountsContent() {
  const { accounts, isLoading } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const editAccount =
    editAccountId !== null
      ? (accounts.find((account) => account.id === editAccountId) ?? null)
      : null;

  const deleteAccount =
    deleteAccountId !== null
      ? (accounts.find((account) => account.id === deleteAccountId) ?? null)
      : null;

  const visibleAccounts = useMemo(() => {
    if (showHidden) {
      return accounts;
    }

    return accounts.filter((account) => isAccountVisible(account));
  }, [accounts, showHidden]);

  const hiddenCount = accounts.length - accounts.filter(isAccountVisible).length;

  if (isLoading) {
    return <SkeletonGrid count={3} />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <Button onClick={() => setIsModalOpen(true)}>Add account</Button>
        }
      />

      <BankSyncPlaceholder />

      {hiddenCount > 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <div>
            <p className="text-sm font-medium text-white">Show hidden accounts</p>
            <p className="mt-1 text-xs text-white/45">
              {hiddenCount} hidden or archived account
              {hiddenCount === 1 ? "" : "s"}
            </p>
          </div>
          <PreferenceToggle
            checked={showHidden}
            onChange={setShowHidden}
            label="Show hidden accounts"
          />
        </div>
      )}

      {visibleAccounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title={accounts.length > 0 ? "No visible accounts" : "No accounts yet"}
          description={
            accounts.length > 0
              ? "Turn on hidden accounts or add a new account to continue."
              : "Add your first account to start tracking your finances."
          }
          actionLabel="Add account"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setEditAccountId(account.id)}
              onDelete={() => setDeleteAccountId(account.id)}
            />
          ))}
        </div>
      )}

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <EditAccountModal
        account={editAccount}
        onClose={() => setEditAccountId(null)}
      />

      <DeleteAccountModal
        account={deleteAccount}
        onClose={() => setDeleteAccountId(null)}
      />
    </div>
  );
}
