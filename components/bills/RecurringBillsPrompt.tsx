"use client";

import { useFinance } from "@/context/FinanceContext";
import {
  RecurringBillsFoundCard,
  RecurringBillsFoundModal,
} from "@/components/bills/RecurringBillsFoundModal";
import { useNativeIos } from "@/lib/native/useNativeIos";

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
  const nativeIos = useNativeIos();

  if (recurringBillCandidates.length === 0) {
    return null;
  }

  return (
    <>
      {/* iOS shows a compact “Review” cue on Bills instead of a global card. */}
      {!nativeIos && !showRecurringBillsModal ? (
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
