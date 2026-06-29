"use client";

import { useCallback, useMemo } from "react";
import type { DirectDepositMatch } from "@/lib/incomePlan/plaidTypes";
import { incomePlanPlaidService } from "@/lib/incomePlan/plaidService";

export function useIncomePlanDirectDeposit() {
  const service = useMemo(() => incomePlanPlaidService, []);

  const checkDeposit = useCallback(
    async (amount: number, postedDate: string) => {
      return service.matchDirectDeposit(amount, postedDate);
    },
    [service],
  );

  const createPrompt = useCallback(
    (onApply: (match: DirectDepositMatch) => void) =>
      service.createHook(onApply),
    [service],
  );

  return {
    checkDeposit,
    createPrompt,
    isPlaidEnabled: false,
  };
}
