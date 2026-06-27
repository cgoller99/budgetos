export type CalculationResult = {
  value: number;
  monthlyChange: number;
};

export type FinancialHealthReason = {
  factor: string;
  impact: "positive" | "neutral" | "negative";
  message: string;
};

export type FinancialHealthResult = {
  score: number;
  reasons: FinancialHealthReason[];
  strokeDasharray: number;
  strokeDashoffset: number;
  savingsRateLabel: string;
  debtLoadLabel: string;
  debtUtilizationLabel: string;
  emergencyFundLabel: string;
  savingsRateTone: "emerald" | "amber";
  debtLoadTone: "emerald" | "amber";
  debtUtilizationTone: "emerald" | "amber";
  emergencyFundTone: "emerald" | "amber";
};

export type SavingsProgressResult = {
  savingsRate: number;
  monthlySavings: number;
  monthlyIncome: number;
  annualSavingsProjection: number;
  goalProgress: {
    id: string;
    name: string;
    current: number;
    target: number;
    percent: number;
  }[];
};

export type CashFlowResult = {
  income: number;
  spending: number;
  netFlow: number;
  incomeBarWidthPercent: number;
  spendingBarWidthPercent: number;
};

export type NetWorthBreakdown = {
  cash: CalculationResult;
  investments: CalculationResult;
  debt: CalculationResult;
  assets: number;
  liabilities: number;
  netWorth: CalculationResult;
};
