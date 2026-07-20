"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import type { GoalType, SavingsGoal } from "@/lib/finance/types";

type EditGoalModalProps = {
  goal: SavingsGoal | null;
  onClose: () => void;
};

type FormState = {
  name: string;
  type: GoalType;
  target: string;
};

const emptyForm: FormState = {
  name: "",
  type: "custom",
  target: "",
};

export function EditGoalModal({ goal, onClose }: EditGoalModalProps) {
  const { editGoal } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!goal) {
      setForm(emptyForm);
      return;
    }

    setForm({
      name: goal.name,
      type: goal.type,
      target: goal.target.toString(),
    });
  }, [goal]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!goal) return;

    const target = Number.parseFloat(form.target);

    if (!form.name.trim() || Number.isNaN(target)) {
      return;
    }

    try {
      await editGoal(goal.id, {
        name: form.name,
        type: form.type,
        target,
      });

      showToast({
        title: `✓ ${form.name.trim()} Updated`,
        subtitle: "✓ Dashboard Updated",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={Boolean(goal)} onClose={handleClose} title="Edit Goal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Goal Name">
          <Input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </FormField>

        <FormField label="Goal Type">
          <Select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as GoalType,
              }))
            }
          >
            {GOAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                {option.icon} {option.label}
              </option>
            ))}
          </Select>
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
            required
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
