"use client";

import { useFinance } from "@/context/FinanceContext";
import {
  RecurringBillsFoundCard,
  RecurringBillsFoundModal,
} from "@/components/bills/RecurringBillsFoundModal";

export function RecurringBillsPrompt() {
  const {
    recurringBillCandidates,
    showRecurringBillsModal,
    isApplyingRecurringBills,
    openRecurringBillsModal,
    closeRecurringBillsModal,
    addSelectedRecurringBills,
    ignoreSelectedRecurringBills,
    snoozeRecurringBillsPrompt,
  } = useFinance();

  if (recurringBillCandidates.length === 0) {
    return null;
  }

  return (
    <>
      {!showRecurringBillsModal ? (
        <RecurringBillsFoundCard
          candidates={recurringBillCandidates}
          onReview={openRecurringBillsModal}
        />
      ) : null}

      <RecurringBillsFoundModal
        isOpen={showRecurringBillsModal}
        candidates={recurringBillCandidates}
        isSubmitting={isApplyingRecurringBills}
        onAddSelected={addSelectedRecurringBills}
        onIgnore={ignoreSelectedRecurringBills}
        onRemindLater={() => void snoozeRecurringBillsPrompt()}
        onClose={closeRecurringBillsModal}
      />
    </>
  );
}
