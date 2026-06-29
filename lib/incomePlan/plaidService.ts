import type {
  DirectDepositMatch,
  IncomePlanDirectDepositHook,
  IncomePlanPlaidService,
} from "@/lib/incomePlan/plaidTypes";

/**
 * Stub for future Plaid direct-deposit detection.
 * When integrated, call `onDirectDepositDetected` after matching a deposit
 * to the user's configured paycheck amount and schedule.
 */
export class IncomePlanPlaidServiceStub implements IncomePlanPlaidService {
  async matchDirectDeposit(): Promise<DirectDepositMatch | null> {
    return null;
  }

  createHook(onApply: (match: DirectDepositMatch) => void): IncomePlanDirectDepositHook {
    return {
      promptLabel: "Direct deposit detected. Apply Income Plan?",
      onConfirm: onApply,
      onDismiss: () => {},
    };
  }
}

export const incomePlanPlaidService: IncomePlanPlaidService =
  new IncomePlanPlaidServiceStub();
