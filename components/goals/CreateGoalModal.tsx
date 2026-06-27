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
import { GOAL_TYPE_OPTIONS } from "@/lib/finance/goalTypes";
import type { GoalType } from "@/lib/finance/types";

type CreateGoalModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FormState = {
  name: string;
  type: GoalType;
  current: string;
  target: string;
};

const initialFormState: FormState = {
  name: "",
  type: "custom",
  current: "",
  target: "",
};

export function CreateGoalModal({ isOpen, onClose }: CreateGoalModalProps) {
  const { createGoal } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(initialFormState);

  function handleClose() {
    setForm(initialFormState);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const current = Number.parseFloat(form.current);
    const target = Number.parseFloat(form.target);

    if (!form.name.trim() || Number.isNaN(current) || Number.isNaN(target)) {
      return;
    }

    createGoal({
      name: form.name,
      type: form.type,
      current,
      target,
    });

    showToast({
      title: `✓ ${form.name.trim()} Goal Created`,
      subtitle: "✓ Dashboard Updated",
    });

    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Goal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Goal Type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GOAL_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    type: option.value,
                    name:
                      current.name ||
                      (option.value === "custom" ? "" : option.label),
                  }))
                }
                className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                  form.type === option.value
                    ? "border-[#0077ed]/40 bg-[#0077ed]/10"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]"
                }`}
              >
                <span className="text-lg">{option.icon}</span>
                <span className="mt-1 block text-xs font-medium text-white/75">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Goal Name">
          <Input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Dream Home, Italy Trip..."
            required
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Current Saved">
            <Input
              type="number"
              step="0.01"
              value={form.current}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  current: event.target.value,
                }))
              }
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField label="Target Amount">
            <Input
              type="number"
              step="0.01"
              value={form.target}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  target: event.target.value,
                }))
              }
              placeholder="0.00"
              required
            />
          </FormField>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Goal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
