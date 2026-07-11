"use client";

import { Button, Modal } from "@/components/ui";
import type { Account } from "@/lib/finance/types";

type ManualAccountsPlaidMergeModalProps = {
  isOpen: boolean;
  manualAccounts: Account[];
  plaidAccountCount: number;
  isPending?: boolean;
  onKeepManual: () => void | Promise<void>;
  onRemoveManual: () => void | Promise<void>;
};

export function ManualAccountsPlaidMergeModal({
  isOpen,
  manualAccounts,
  plaidAccountCount,
  isPending = false,
  onKeepManual,
  onRemoveManual,
}: ManualAccountsPlaidMergeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => void onKeepManual()} title="Manual accounts found">
      <div className="space-y-4 text-sm leading-relaxed text-white/60">
        <p>
          Plaid imported {plaidAccountCount} account{plaidAccountCount === 1 ? "" : "s"}. You also
          have {manualAccounts.length} manual account{manualAccounts.length === 1 ? "" : "s"}:
        </p>
        <ul className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white/75">
          {manualAccounts.map((account) => (
            <li key={account.id}>
              {account.name} · {account.institution}
            </li>
          ))}
        </ul>
        <p>Would you like to keep your manual accounts alongside Plaid, or remove them?</p>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" disabled={isPending} onClick={() => void onKeepManual()}>
          Keep manual accounts
        </Button>
        <Button size="md" disabled={isPending} onClick={() => void onRemoveManual()}>
          {isPending ? "Removing..." : "Remove manual accounts"}
        </Button>
      </div>
    </Modal>
  );
}
