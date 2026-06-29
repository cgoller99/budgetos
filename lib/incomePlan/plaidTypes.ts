export type DirectDepositMatch = {
  amount: number;
  postedDate: string;
  planId: string;
  confidence: number;
};

export type IncomePlanDirectDepositHook = {
  promptLabel: string;
  onConfirm: (match: DirectDepositMatch) => void;
  onDismiss: () => void;
};

export type IncomePlanPlaidService = {
  matchDirectDeposit: (
    amount: number,
    postedDate: string,
  ) => Promise<DirectDepositMatch | null>;
  createHook: (
    onApply: (match: DirectDepositMatch) => void,
  ) => IncomePlanDirectDepositHook;
};
