"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/finance/accountTypes";
import type { AccountType } from "@/lib/finance/types";

type AddAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FormState = {
  name: string;
  institution: string;
  type: AccountType;
  balance: string;
};

const initialFormState: FormState = {
  name: "",
  institution: "",
  type: "checking",
  balance: "",
};

export function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const { addAccount } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(initialFormState);

  function handleClose() {
    setForm(initialFormState);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const balance = Number.parseFloat(form.balance);

    if (!form.name.trim() || !form.institution.trim() || Number.isNaN(balance)) {
      return;
    }

    addAccount({
      name: form.name,
      institution: form.institution,
      type: form.type,
      balance,
    });

    showToast({
      title: `✓ ${form.name.trim()} Account Added`,
      subtitle: "✓ Dashboard Updated",
    });

    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Account Name">
          <Input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Primary Checking"
            required
          />
        </FormField>

        <FormField label="Institution">
          <Input
            type="text"
            value={form.institution}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                institution: event.target.value,
              }))
            }
            placeholder="Chase, Fidelity, Coinbase..."
            required
          />
        </FormField>

        <FormField label="Account Type">
          <Select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as AccountType,
              }))
            }
          >
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Current Balance">
          <Input
            type="number"
            step="0.01"
            value={form.balance}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                balance: event.target.value,
              }))
            }
            placeholder="0.00"
            required
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
