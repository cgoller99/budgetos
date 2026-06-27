import type { ActivityItem, FinanceEvent, NotificationItem } from "@/lib/events/types";
import type {
  AutoContribution,
  BillFrequency,
  IncomeFrequency,
  RecurringSchedule,
  TodayActivitySummary,
} from "@/lib/recurring/types";
import type { MilestoneCategory } from "@/lib/roadmap/types";

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
  nextPayDate: string;
  lastPaid: string;
  isActive: boolean;
  statusLabel: string;
  canMarkReceived: boolean;
};

export type BillStatus = "upcoming" | "due_today" | "overdue" | "paid";

export type AddBillInput = {
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
};

export type EditBillInput = {
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
};

export type GoalType =
  | "house"
  | "emergency_fund"
  | "vacation"
  | "wedding"
  | "car"
  | "retirement"
  | "custom";

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
};

export type BillProgress = {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;
  dueDate: Date | null;
  formattedDueDate: string;
  autopay: boolean;
  recurring: boolean;
  status: BillStatus;
  statusLabel: string;
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
};

export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  category: string;
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

export type FinanceData = {
  accounts: Account[];
  bills: Bill[];
  income: IncomeSource[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  investments: Investment[];
  transactions: Transaction[];
  events: FinanceEvent[];
};

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
  billsSummary: BillsDashboardSummary;
  debtsSummary: DebtsDashboardSummary;
  weeklyPlan: WeeklyPlanRecommendation[];
  todayActivity: TodayActivitySummary;
};

export type { ActivityItem, NotificationItem };
