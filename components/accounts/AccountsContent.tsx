"use client";

import { useState } from "react";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AddAccountModal } from "@/components/accounts/AddAccountModal";
import { BankSyncPlaceholder } from "@/components/accounts/BankSyncPlaceholder";
import { Button, EmptyState, PageHeader, SkeletonGrid } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";

export function AccountsContent() {
  const { accounts, isLoading } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first account to start tracking your finances."
          actionLabel="Add account"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
