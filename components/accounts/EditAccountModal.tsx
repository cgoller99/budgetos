"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AccountFormFields,
  accountToFormState,
  initialAccountFormState,
  parseAccountForm,
} from "@/components/accounts/AccountFormFields";
import { Modal } from "@/components/ui";
import {
  NativeDestructiveButton,
  NativeEditorActions,
} from "@/components/native/NativeEditorActions";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getAccountDisplayName } from "@/lib/finance/accountPreferences";
import type { Account } from "@/lib/finance/types";

const EDIT_ACCOUNT_FORM_ID = "edit-account-form";

type EditAccountModalProps = {
  account: Account | null;
  onClose: () => void;
  onRemove?: () => void;
};

export function EditAccountModal({ account, onClose, onRemove }: EditAccountModalProps) {
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
      footer={
        <NativeEditorActions
          formId={EDIT_ACCOUNT_FORM_ID}
          onCancel={onClose}
          submitLabel="Save Changes"
          submittingLabel="Saving…"
          isSubmitting={isSubmitting}
          destructive={
            account?.isPlaidLinked && onRemove ? (
              <NativeDestructiveButton
                label="Remove bank account"
                onClick={onRemove}
                disabled={isSubmitting}
              />
            ) : undefined
          }
        />
      }
    >
      {account ? (
        <form
          id={EDIT_ACCOUNT_FORM_ID}
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <AccountFormFields account={account} form={form} onChange={setForm} />
        </form>
      ) : null}
    </Modal>
  );
}
