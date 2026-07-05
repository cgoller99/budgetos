import type { ContributionFrequency } from "@/lib/recurring/types";
import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanPaycheckEvent,
  IncomePlanSchedule,
  MarkPaycheckReceivedInput,
  ResolvedAllocation,
} from "@/lib/incomePlan/types";

export type AllocationType = "fixed" | "percentage" | "remaining";

export type EnvelopeType =
  | "goal"
  | "bill"
  | "savings"
  | "investment"
  | "debt"
  | "category"
  | "account";

export type AllocationFrequency = IncomePlanSchedule;

export type VirtualEnvelope = {
  id: string;
  allocationId: string | null;
  envelopeType: EnvelopeType;
  entityId: string | null;
  name: string;
  icon: string;
  balance: number;
  target: number | null;
  contributionAmount: number | null;
  contributionFrequency: ContributionFrequency | AllocationFrequency | null;
  progress: number;
  nextContributionDate: string | null;
  history: EnvelopeHistoryEntry[];
};

export type EnvelopeHistoryEntry = {
  date: string;
  amount: number;
  source: string;
  ledgerEntryId: string;
};

export type AllocationLedgerEntry = {
  id: string;
  paycheckEventId: string | null;
  allocationId: string | null;
  sourceAccountId: string | null;
  destinationType: EnvelopeType | "account";
  destinationId: string | null;
  destinationName: string;
  amount: number;
  transferDate: string;
  frequency: AllocationFrequency | null;
  transactionId: string | null;
  entryType: "paycheck_allocation" | "recurring_contribution" | "manual_transfer";
  createdAt: string;
};

export type ForecastHorizon = "30d" | "90d" | "6mo" | "1yr";

export type EnvelopeForecastPoint = {
  date: string;
  balance: number;
  contribution: number;
};

export type EnvelopeForecast = {
  envelopeId: string;
  name: string;
  horizon: ForecastHorizon;
  currentBalance: number;
  projectedBalance: number;
  totalContributions: number;
  points: EnvelopeForecastPoint[];
};

export type AllocationForecast = {
  horizon: ForecastHorizon;
  horizonDays: number;
  paycheckCount: number;
  totalIncome: number;
  envelopes: EnvelopeForecast[];
  generatedAt: string;
};

export type LedgerReport = {
  totalTransferred: number;
  paycheckAllocations: number;
  recurringContributions: number;
  byDestination: Array<{
    destinationName: string;
    destinationType: string;
    total: number;
    count: number;
  }>;
  recentEntries: AllocationLedgerEntry[];
};

export type PaycheckExecutionResult = {
  data: import("@/lib/finance/types").FinanceData;
  paycheckEvent: IncomePlanPaycheckEvent;
  ledgerEntries: AllocationLedgerEntry[];
  resolvedAllocations: ResolvedAllocation[];
};

export type RecurringContributionDue = {
  envelopeId: string;
  allocationId: string | null;
  entityId: string | null;
  envelopeType: EnvelopeType;
  name: string;
  amount: number;
  dueDate: string;
  frequency: string;
};

export type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanPaycheckEvent,
  MarkPaycheckReceivedInput,
  ResolvedAllocation,
};
