"use client";

import { useState } from "react";
import { AddAccountModal } from "@/components/accounts/AddAccountModal";
import { AddBillModal } from "@/components/bills/AddBillModal";
import { AddIncomeModal } from "@/components/income/AddIncomeModal";
import { AddSavingsGoalModal } from "@/components/savings/AddSavingsGoalModal";
import { Button, Card } from "@/components/ui";
import { panelDescriptionClassName, panelTitleClassName } from "@/components/ui/tokens";

type QuickAction = "account" | "income" | "bill" | "goal";

const QUICK_ACTIONS: {
  id: QuickAction;
  label: string;
}[] = [
  { id: "account", label: "Add Account" },
  { id: "income", label: "Add Income" },
  { id: "bill", label: "Add Bill" },
  { id: "goal", label: "Add Savings Goal" },
];

export function QuickActions() {
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);

  function closeModal() {
    setActiveAction(null);
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className={panelTitleClassName}>Quick Actions</h2>
            <p className={panelDescriptionClassName}>
              Add data instantly and watch your dashboard update live.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveAction(action.id)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <AddAccountModal
        isOpen={activeAction === "account"}
        onClose={closeModal}
      />
      <AddIncomeModal isOpen={activeAction === "income"} onClose={closeModal} />
      <AddBillModal isOpen={activeAction === "bill"} onClose={closeModal} />
      <AddSavingsGoalModal isOpen={activeAction === "goal"} onClose={closeModal} />
    </>
  );
}
