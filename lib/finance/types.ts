import type { ActivityItem, FinanceEvent, NotificationItem } from "@/lib/events/types";
import type {
  AutoContribution,
  BillFrequency,
  IncomeFrequency,
  RecurringSchedule,
  TodayActivitySummary,
} from "@/lib/recurring/types";
import type { MilestoneCategory } from "@/lib/roadmap/types";
import type {
  IncomePlan,
  IncomePlanPaycheckEvent,
  SaveIncomePlanInput,
  MarkPaycheckReceivedInput,
} from "@/lib/incomePlan/types";

export type {
  AutoContribution,
  BillFrequency,
  IncomeFrequency,
  RecurringSchedule,
  TodayActivitySummary,
} from "@/lib/recurring/types";

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "investment"
  | "crypto"
  | "cash";

export type Account = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  balance: number;
  monthlyChange: number;
  institutionLogoUrl?: string | null;
  availableBalance?: number | null;
  lastFour?: string | null;
  lastSyncedAt?: string | null;
  bankConnectionId?: string | null;
  externalAccountId?: string | null;
  isPlaidLinked?: boolean;
};

export type AddAccountInput = {
  name: string;
  institution: string;
  type: AccountType;
  balance: number;
};

export type AddIncomeInput = {
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  category: string;
  startDate?: string;
  depositAccountId?: string | null;
};

export type EditIncomeInput = AddIncomeInput;

export type IncomeDashboardSummary = {
  monthlyIncome: number;
  annualIncome: number;
  activeSourceCount: number;
  sourceCount: number;
  nextPaycheck: {
    id: string;
    name: string;
    amount: number;
    formattedDate: string;
    daysUntil: number;
  } | null;
};

export type IncomeTableRow = {
  id: string;
  name: string;
  amount: number;
  frequencyLabel: string;
  category: string;
  depositAccountName: string;
  startDate: string;
  nextPayDate: string;
  lastPaid: string;
  isActive: boolean;
  statusLabel: string;
  canMarkReceived: boolean;
  isFromIncomePlan?: boolean;
};

export type BillStatus =
  | "upcoming"
  | "due_soon"
  | "due_today"
  | "overdue"
  | "partial"
  | "paid";

export type PaycheckAssignment =
  | "first_paycheck"
  | "second_paycheck"
  | "weekly"
  | "biweekly"
  | "custom";

export type BillSplitInput = {
  id?: string;
  amount: number;
  dueDay: number;
  paycheckAssignment?: PaycheckAssignment;
  customPayDay?: number | null;
  paymentAccountId?: string | null;
  paidMonth?: string | null;
  paidAmount?: number;
  sortOrder?: number;
};

export type AddBillInput = {
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
  frequency?: BillFrequency;
  startDate?: string;
  paycheckAssignment?: PaycheckAssignment;
  customPayDay?: number | null;
  paymentAccountId?: string | null;
  splits?: BillSplitInput[];
};

export type EditBillInput = {
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
  frequency?: BillFrequency;
  startDate?: string;
  paycheckAssignment?: PaycheckAssignment;
  customPayDay?: number | null;
  paymentAccountId?: string | null;
  splits?: BillSplitInput[];
};

export type GoalType =
  | "emergency_fund"
  | "house"
  | "vacation"
  | "car"
  | "engagement_ring"
  | "wedding"
  | "investments"
  | "debt_payoff"
  | "custom"
  | "retirement";

export type CreateGoalInput = {
  name: string;
  type: GoalType;
  current: number;
  target: number;
};

export type EditGoalInput = {
  name: string;
  type: GoalType;
  target: number;
};

export type AddSavingsGoalInput = CreateGoalInput;

export type AddMoneyToGoalInput = {
  goalId: string;
  amount: number;
};

export type BillSplit = {
  id: string;
  billId: string;
  amount: number;
  dueDay: number;
  paycheckAssignment: PaycheckAssignment;
  customPayDay?: number | null;
  paymentAccountId?: string | null;
  paidMonth: string | null;
  paidAmount: number;
  sortOrder: number;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
  paidMonth: string | null;
  frequency?: BillFrequency;
  schedule?: RecurringSchedule;
  paycheckAssignment?: PaycheckAssignment;
  customPayDay?: number | null;
  paymentAccountId?: string | null;
  splits?: BillSplit[];
};

export type BillProgress = {
  id: string;
  billId: string;
  splitId: string;
  name: string;
  category: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDay: number;
  dueDate: Date | null;
  formattedDueDate: string;
  autopay: boolean;
  recurring: boolean;
  status: BillStatus;
  statusLabel: string;
  paycheckAssignment: PaycheckAssignment;
  paymentAccountId?: string | null;
  splitCount: number;
};

export type NextBillSummary = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  status: BillStatus;
};

export type BillsDashboardSummary = {
  dueThisWeekCount: number;
  dueThisWeekAmount: number;
  totalMonthlyBills: number;
  nextBill: NextBillSummary | null;
  monthlyCashRemaining: number;
  safeToSpendAfterUpcomingBills: number;
};

export type CalendarBillEntry = {
  id: string;
  billId: string;
  splitId: string;
  name: string;
  amount: number;
  status: BillStatus;
  statusLabel: string;
  category: string;
};

export type CalendarDaySummary = {
  date: string;
  day: number;
  bills: CalendarBillEntry[];
  totalDue: number;
  dominantStatus: BillStatus | null;
};

export type PaycheckPeriodSummary = {
  id: PaycheckAssignment;
  label: string;
  income: number;
  billsTotal: number;
  remaining: number;
  bills: BillProgress[];
  isUpcoming: boolean;
};

export type PaycheckSplitSummary = {
  periods: PaycheckPeriodSummary[];
  upcomingPeriodId: PaycheckAssignment | null;
  totalIncome: number;
  totalBills: number;
  totalRemaining: number;
};

export type HouseholdRole = "owner" | "member";

export type Household = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

export type HouseholdMember = {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  joinedAt: string;
  email?: string | null;
};

export type HouseholdInvite = {
  id: string;
  householdId: string;
  email: string;
  role: HouseholdRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  token?: string;
};

export type BankConnectionStatus =
  | "pending"
  | "connected"
  | "error"
  | "disconnected";

export type BankConnection = {
  id: string;
  provider: string;
  status: BankConnectionStatus;
  institutionName: string | null;
  institutionLogoUrl?: string | null;
  institutionId?: string | null;
  externalItemId?: string | null;
  lastSyncedAt: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  category: string;
  depositAccountId?: string | null;
  schedule?: RecurringSchedule;
};

export type SavingsGoal = {
  id: string;
  name: string;
  type: GoalType;
  icon: string;
  current: number;
  target: number;
  createdAt: string;
  autoContribution?: AutoContribution;
};

export type DebtAccountType =
  | "credit_card"
  | "personal_loan"
  | "student_loan"
  | "auto_loan"
  | "mortgage"
  | "medical"
  | "other";

export type DebtStrategy = "snowball" | "avalanche";

export type Debt = {
  id: string;
  name: string;
  balance: number;
  originalBalance: number;
  interestRate: number;
  minimumPayment: number;
  monthlyChange: number;
  dueDay: number;
  accountType: DebtAccountType;
  institution?: string;
  lastFour?: string | null;
  isPlaidLinked?: boolean;
  bankConnectionId?: string | null;
  institutionLogoUrl?: string | null;
  lastSyncedAt?: string | null;
};

export type AddDebtInput = {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  dueDay: number;
  accountType: DebtAccountType;
};

export type EditDebtInput = AddDebtInput;

export type MakeDebtPaymentInput = {
  amount: number;
};

export type DebtsDashboardSummary = {
  totalDebt: number;
  totalMinimumPayments: number;
  estimatedDebtFreeDate: string;
  interestPaidThisYear: number;
  nextPayment: {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
  } | null;
  debtFreeProgress: number;
  activeDebtCount: number;
};

export type DebtTableRow = {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  dueDate: string;
  accountType: DebtAccountType;
  accountTypeLabel: string;
  progressPercent: number;
  progressLabel: string;
};

export type DebtStrategyInsight = {
  strategy: DebtStrategy;
  recommendedDebt: {
    id: string;
    name: string;
    balance: number;
    interestRate: number;
  } | null;
  extraPayment: number;
  monthsSaved: number;
  interestSaved: number;
  estimatedPayoffDate: string;
  baselinePayoffDate: string;
};

export type Investment = {
  id: string;
  name: string;
  value: number;
  monthlyChange: number;
  monthlyContribution: number;
  type: string;
  autoContribution?: AutoContribution;
};

export type TransactionType = "income" | "expense" | "transfer";

export type Transaction = {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  transferAccountId: string | null;
  date: string;
  notes: string;
  goalId?: string | null;
  billId?: string | null;
  debtId?: string | null;
  externalTransactionId?: string | null;
};

export type AddTransactionInput = {
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  transferAccountId?: string | null;
  date: string;
  notes?: string;
  goalId?: string | null;
};

export type EditTransactionInput = AddTransactionInput;

export type StoredEnvelopeBalance = {
  id: string;
  allocationId: string | null;
  envelopeType: string;
  entityId: string | null;
  name: string;
  icon: string;
  balance: number;
  target: number | null;
  contributionAmount: number | null;
  contributionFrequency: string | null;
  progress: number;
  nextContributionDate: string | null;
  history: Array<{
    date: string;
    amount: number;
    source: string;
    ledgerEntryId: string;
  }>;
  updatedAt: string;
};

export type FinanceData = {
  accounts: Account[];
  bills: Bill[];
  income: IncomeSource[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  investments: Investment[];
  transactions: Transaction[];
  events: FinanceEvent[];
  incomePlan: IncomePlan | null;
  incomePlanPaychecks: IncomePlanPaycheckEvent[];
  envelopeBalances: StoredEnvelopeBalance[];
  allocationLedger: import("@/lib/allocation/types").AllocationLedgerEntry[];
  bankConnections: BankConnection[];
  plaidRecurringDismissals: string[];
};

export type { IncomePlan, IncomePlanPaycheckEvent, SaveIncomePlanInput, MarkPaycheckReceivedInput };

export type KPIMetric = {
  label: string;
  value: number;
  monthlyChange: number;
  positiveChange?: boolean;
};

export type MoneyFlowMetric = {
  amount: number;
  barWidthPercent: number;
};

export type MoneyFlowStageData = {
  id: string;
  label: string;
  icon: string;
  color: string;
  glowColor: string;
  amount: number;
  percentOfIncome: number;
  isOutflow: boolean;
};

export type MoneyFlowBreakdownItem = {
  id: string;
  label: string;
  amount: number;
  percentOfIncome: number;
  isOutflow: boolean;
};

export type MoneyFlowData = {
  income: number;
  bills: number;
  debts: number;
  goals: number;
  investments: number;
  safeToSpend: number;
  stages: MoneyFlowStageData[];
  breakdown: MoneyFlowBreakdownItem[];
  /** @deprecated use stages/breakdown */
  spending: MoneyFlowMetric;
  /** @deprecated use safeToSpend */
  netFlow: number;
};

export type HealthScoreTone = "emerald" | "amber";

export type HealthScoreMetric = {
  label: string;
  value: string;
  tone: HealthScoreTone;
};

export type FinancialHealthScoreData = {
  score: number;
  strokeDasharray: number;
  strokeDashoffset: number;
  reasons: string[];
  metrics: HealthScoreMetric[];
};

export type InsightTone = "blue" | "emerald" | "amber";

export type SmartInsight = {
  tone: InsightTone;
  before: string;
  highlight?: string;
  after: string;
  transactionHref?: string;
};

export type NextGoalSummary = {
  id: string;
  name: string;
  icon: string;
  percentComplete: number;
  estimatedCompletionDate: string;
  remaining: number;
};

export type NextMilestoneSummary = {
  id: string;
  category: MilestoneCategory;
  name: string;
  icon: string;
  percentComplete: number;
  estimatedCompletionDate: string;
  remaining: number;
};

export type PlanPriority = "critical" | "attention" | "positive";

export type WeeklyPlanRecommendation = {
  id: string;
  message: string;
  priority: PlanPriority;
};

export type DashboardData = {
  kpiMetrics: KPIMetric[];
  moneyFlow: MoneyFlowData;
  financialHealthScore: FinancialHealthScoreData;
  smartInsights: SmartInsight[];
  nextGoal: NextGoalSummary | null;
  nextMilestone: NextMilestoneSummary | null;
  nextPaycheck: IncomeDashboardSummary["nextPaycheck"];
  billsSummary: BillsDashboardSummary;
  debtsSummary: DebtsDashboardSummary;
  weeklyPlan: WeeklyPlanRecommendation[];
  todayActivity: TodayActivitySummary;
};

export type { ActivityItem, NotificationItem };
