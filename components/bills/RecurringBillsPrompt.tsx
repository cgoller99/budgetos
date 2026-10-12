"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import {
  RecurringBillsFoundCard,
  RecurringBillsFoundModal,
} from "@/components/bills/RecurringBillsFoundModal";
import { findSubscriptionPriceIncreases } from "@/lib/automation/financialInsights";
import { useNativeIos } from "@/lib/native/useNativeIos";

export function RecurringBillsPrompt() {
  const finance = useFinance();
  const {
    recurringBillCandidates,
    showRecurringBillsModal,
    isApplyingRecurringBills,
    openRecurringBillsModal,
    closeRecurringBillsModal,
    addSelectedRecurringBills,
    ignoreSelectedRecurringBills,
    dismissRecurringCandidate,
    snoozeRecurringBillsPrompt,
  } = finance;
  const nativeIos = useNativeIos();
  const priceAlertCount = useMemo(
    () => findSubscriptionPriceIncreases(finance).length,
    [finance],
  );
  const reviewCount = recurringBillCandidates.length + priceAlertCount;

  if (reviewCount === 0 && !showRecurringBillsModal) {
    return null;
  }

  return (
    <>
      {/* iOS shows a compact Review cue on Bills instead of a global card. */}
      {!nativeIos && !showRecurringBillsModal ? (
        <RecurringBillsFoundCard
          candidates={recurringBillCandidates}
          priceAlertCount={priceAlertCount}
          onReview={openRecurringBillsModal}
        />
      ) : null}

      <RecurringBillsFoundModal
        isOpen={showRecurringBillsModal}
        candidates={recurringBillCandidates}
        isSubmitting={isApplyingRecurringBills}
        onAddSelected={addSelectedRecurringBills}
        onIgnore={ignoreSelectedRecurringBills}
        onDismiss={dismissRecurringCandidate}
        onRemindLater={() => void snoozeRecurringBillsPrompt()}
        onClose={closeRecurringBillsModal}
      />
    </>
  );
}
