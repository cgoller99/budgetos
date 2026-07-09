"use client";

import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Account } from "@/lib/finance/types";

type DeleteAccountModalProps = {
  account: Account | null;
  onClose: () => void;
};

export function DeleteAccountModal({ account, onClose }: DeleteAccountModalProps) {
  const { deleteAccount } = useFinance();
  const { showToast } = useToast();
  const isPlaidLinked = Boolean(account?.isPlaidLinked);

  async function handleDelete() {
    if (!account || isPlaidLinked) {
      return;
    }

    try {
      await deleteAccount(account.id);

      showToast({
        title: `✓ ${account.name} Deleted`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={account !== null} onClose={onClose} title="Delete Account">
      <div className="space-y-4">
        {isPlaidLinked ? (
          <p className="text-sm leading-relaxed text-white/60">
            <span className="font-medium text-white">{account?.name}</span> is
            linked to a bank connection. Disconnect the institution in Settings
            to remove linked accounts.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-white/60">
            Are you sure you want to delete{" "}
            <span className="font-medium text-white">{account?.name}</span>? This
            removes {formatCurrency(account?.balance ?? 0)} from your accounts
            and dashboard. Existing transactions will stay, but will no longer be
            tied to this account.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {isPlaidLinked ? "Close" : "Cancel"}
          </Button>
          {!isPlaidLinked && (
            <Button
              type="button"
              fullWidth
              onClick={() => void handleDelete()}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Delete Account
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
