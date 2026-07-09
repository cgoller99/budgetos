"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AccountFormFields,
  accountToFormState,
  initialAccountFormState,
  parseAccountForm,
} from "@/components/accounts/AccountFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getAccountDisplayName } from "@/lib/finance/accountPreferences";
import type { Account } from "@/lib/finance/types";

type EditAccountModalProps = {
  account: Account | null;
  onClose: () => void;
};

export function EditAccountModal({ account, onClose }: EditAccountModalProps) {
  const { editAccount } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    account ? accountToFormState(account) : initialAccountFormState,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (account) {
      setForm(accountToFormState(account));
    }
  }, [account]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!account) {
      return;
    }

    const parsed = parseAccountForm(form, Boolean(account.isPlaidLinked));

    if (!parsed) {
      return;
    }

    setIsSubmitting(true);

    try {
      await editAccount(account.id, parsed);

      showToast({
        title: `✓ ${getAccountDisplayName({ ...account, nickname: parsed.nickname ?? account.nickname, name: parsed.name ?? account.name })} Updated`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={account !== null}
      onClose={onClose}
      title={account?.isPlaidLinked ? "Edit Linked Account" : "Edit Account"}
    >
      {account && (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <AccountFormFields account={account} form={form} onChange={setForm} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
