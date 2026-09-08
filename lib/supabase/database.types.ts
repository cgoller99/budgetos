export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountRecordKind = "account" | "debt" | "investment";

export type RecurringEntityType = "income" | "bill" | "goal" | "investment";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "goal_contribution"
  | "investment_contribution"
  | "debt_payment";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_complete: boolean;
  onboarding_mode: string | null;
  demo_profile_id: string | null;
  household_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
  subscription_provider: string;
  apple_product_id: string | null;
  apple_original_transaction_id: string | null;
  apple_transaction_id: string | null;
  apple_environment: string | null;
  is_disabled: boolean;
  admin_founder_granted: boolean;
  last_active_at: string | null;
  onboarding_step: number;
  onboarding_progress: Record<string, unknown>;
  beta_status: "pending" | "approved" | "rejected";
  notification_preferences: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  onboarding_complete?: boolean;
  onboarding_mode?: string | null;
  demo_profile_id?: string | null;
  household_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_current_period_end?: string | null;
  subscription_provider?: string;
  apple_product_id?: string | null;
  apple_original_transaction_id?: string | null;
  apple_transaction_id?: string | null;
  apple_environment?: string | null;
  is_disabled?: boolean;
  admin_founder_granted?: boolean;
  last_active_at?: string | null;
  onboarding_step?: number;
  onboarding_progress?: Record<string, unknown>;
  beta_status?: "pending" | "approved" | "rejected";
  notification_preferences?: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = Partial<ProfileInsert>;

export type RecurringColumns = {
  start_date: string | null;
  next_occurrence: string | null;
  last_processed_date: string | null;
  recurring_status: string | null;
};

export type AccountRow = RecurringColumns & {
  id: string;
  user_id: string;
  record_kind: AccountRecordKind;
  name: string;
  institution: string;
  type: string;
  balance: number;
  monthly_change: number;
  interest_rate: number | null;
  minimum_payment: number | null;
  due_day: number | null;
  original_balance: number | null;
  monthly_contribution: number | null;
  contribution_frequency: string | null;
  bank_connection_id: string | null;
  external_account_id: string | null;
  external_item_id: string | null;
  institution_logo_url: string | null;
  available_balance: number | null;
  last_four: string | null;
  last_synced_at: string | null;
  household_id: string | null;
  nickname: string | null;
  icon: string | null;
  color: string | null;
  include_in_net_worth: boolean;
  include_in_safe_to_spend: boolean;
  is_hidden: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountInsert = {
  id?: string;
  user_id: string;
  record_kind?: AccountRecordKind;
  name: string;
  institution?: string;
  type: string;
  balance?: number;
  monthly_change?: number;
  interest_rate?: number | null;
  minimum_payment?: number | null;
  due_day?: number | null;
  original_balance?: number | null;
  monthly_contribution?: number | null;
  contribution_frequency?: string | null;
  bank_connection_id?: string | null;
  external_account_id?: string | null;
  external_item_id?: string | null;
  institution_logo_url?: string | null;
  available_balance?: number | null;
  last_four?: string | null;
  last_synced_at?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  household_id?: string | null;
  nickname?: string | null;
  icon?: string | null;
  color?: string | null;
  include_in_net_worth?: boolean;
  include_in_safe_to_spend?: boolean;
  is_hidden?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AccountUpdate = Partial<AccountInsert>;

export type BillRow = RecurringColumns & {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_day: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
  paid_month: string | null;
  bill_frequency: string | null;
  paycheck_assignment: string | null;
  custom_pay_day: number | null;
  payment_account_id: string | null;
  household_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BillInsert = {
  id?: string;
  user_id: string;
  name: string;
  amount: number;
  due_day?: number;
  autopay?: boolean;
  recurring?: boolean;
  category: string;
  paid_month?: string | null;
  bill_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  paycheck_assignment?: string | null;
  custom_pay_day?: number | null;
  payment_account_id?: string | null;
  household_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BillUpdate = Partial<BillInsert>;

export type BillSplitRow = {
  id: string;
  bill_id: string;
  user_id: string;
  household_id: string | null;
  amount: number;
  due_day: number;
  paycheck_assignment: string | null;
  custom_pay_day: number | null;
  payment_account_id: string | null;
  paid_month: string | null;
  paid_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BillSplitInsert = {
  id?: string;
  bill_id: string;
  user_id: string;
  household_id?: string | null;
  amount: number;
  due_day: number;
  paycheck_assignment?: string | null;
  custom_pay_day?: number | null;
  payment_account_id?: string | null;
  paid_month?: string | null;
  paid_amount?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type BillSplitUpdate = Partial<BillSplitInsert>;

export type GoalRow = RecurringColumns & {
  id: string;
  user_id: string;
  name: string;
  goal_type: string;
  icon: string;
  current_amount: number;
  target_amount: number;
  contribution_amount: number | null;
  contribution_frequency: string | null;
  household_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalInsert = {
  id?: string;
  user_id: string;
  name: string;
  goal_type: string;
  icon?: string;
  current_amount?: number;
  target_amount: number;
  contribution_amount?: number | null;
  contribution_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  household_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GoalUpdate = Partial<GoalInsert>;

export type TransactionRow = RecurringColumns & {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  name: string;
  amount: number;
  frequency: string | null;
  category: string;
  goal_id: string | null;
  account_id: string | null;
  bill_id: string | null;
  transfer_to_account_id: string | null;
  notes: string | null;
  transaction_date: string;
  external_transaction_id: string | null;
  household_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionInsert = {
  id?: string;
  user_id: string;
  transaction_type: TransactionType;
  name: string;
  amount: number;
  frequency?: string | null;
  category?: string;
  goal_id?: string | null;
  account_id?: string | null;
  bill_id?: string | null;
  transfer_to_account_id?: string | null;
  notes?: string | null;
  transaction_date?: string;
  external_transaction_id?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  household_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TransactionUpdate = Partial<TransactionInsert>;

export type InvestmentRow = RecurringColumns & {
  id: string;
  user_id: string;
  name: string;
  type: string;
  value: number;
  monthly_change: number;
  monthly_contribution: number | null;
  contribution_frequency: string | null;
  bank_connection_id: string | null;
  external_account_id: string | null;
  external_item_id: string | null;
  institution_logo_url: string | null;
  available_balance: number | null;
  last_four: string | null;
  last_synced_at: string | null;
  household_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InvestmentInsert = {
  id?: string;
  user_id: string;
  name: string;
  type?: string;
  value?: number;
  monthly_change?: number;
  monthly_contribution?: number | null;
  contribution_frequency?: string | null;
  bank_connection_id?: string | null;
  external_account_id?: string | null;
  external_item_id?: string | null;
  institution_logo_url?: string | null;
  available_balance?: number | null;
  last_four?: string | null;
  last_synced_at?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  household_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InvestmentUpdate = Partial<InvestmentInsert>;

export type RecurringItemRow = RecurringColumns & {
  id: string;
  user_id: string;
  entity_type: RecurringEntityType;
  entity_id: string;
  frequency: string;
  amount: number | null;
  created_at: string;
  updated_at: string;
};

export type RecurringItemInsert = {
  id?: string;
  user_id: string;
  entity_type: RecurringEntityType;
  entity_id: string;
  frequency?: string;
  amount?: number | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RecurringItemUpdate = Partial<RecurringItemInsert>;

export type NotificationRow = {
  id: string;
  user_id: string;
  event_type: string;
  label: string;
  description: string;
  icon: string;
  tone: string;
  surfaces: string[];
  entity_id: string | null;
  entity_type: string | null;
  amount: number | null;
  read: boolean;
  created_at: string;
};

export type NotificationInsert = {
  id?: string;
  user_id: string;
  event_type: string;
  label: string;
  description?: string;
  icon?: string;
  tone?: string;
  surfaces?: string[];
  entity_id?: string | null;
  entity_type?: string | null;
  amount?: number | null;
  read?: boolean;
  created_at?: string;
};

export type NotificationUpdate = Partial<NotificationInsert>;

export type HouseholdRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type HouseholdInsert = {
  id?: string;
  name: string;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
};

export type HouseholdUpdate = Partial<HouseholdInsert>;

export type HouseholdMemberRow = {
  household_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type HouseholdMemberInsert = {
  household_id: string;
  user_id: string;
  role?: string;
  joined_at?: string;
};

export type HouseholdInviteRow = {
  id: string;
  household_id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
};

export type HouseholdInviteInsert = {
  id?: string;
  household_id: string;
  email: string;
  role?: string;
  token?: string;
  status?: string;
  invited_by: string;
  expires_at?: string;
  created_at?: string;
};

export type BankConnectionRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  provider: string;
  status: string;
  institution_name: string | null;
  institution_id: string | null;
  institution_logo_url: string | null;
  external_item_id: string | null;
  access_token_encrypted: string | null;
  access_token_iv: string | null;
  access_token_tag: string | null;
  transactions_cursor: string | null;
  investments_cursor: string | null;
  error_code: string | null;
  error_message: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BankConnectionInsert = {
  id?: string;
  user_id: string;
  household_id?: string | null;
  provider?: string;
  status?: string;
  institution_name?: string | null;
  institution_id?: string | null;
  institution_logo_url?: string | null;
  external_item_id?: string | null;
  access_token_encrypted?: string | null;
  access_token_iv?: string | null;
  access_token_tag?: string | null;
  transactions_cursor?: string | null;
  investments_cursor?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PlaidRecurringDismissalRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  merchant_key: string;
  created_at: string;
};

export type PlaidRecurringDismissalInsert = {
  id?: string;
  user_id: string;
  household_id?: string | null;
  merchant_key: string;
  created_at?: string;
};

export type IncomePlanRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  pay_schedule: string;
  paycheck_amount: number;
  anchor_date: string;
  weekly_day_of_week: number | null;
  monthly_days: number[];
  custom_interval_days: number | null;
  deposit_account_id: string | null;
  next_pay_date: string;
  last_processed_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IncomePlanAllocationRow = {
  id: string;
  income_plan_id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  icon: string;
  amount: number | null;
  percentage: number | null;
  allocation_type: string | null;
  is_remaining_balance: boolean;
  account_id: string | null;
  goal_id: string | null;
  bill_id: string | null;
  debt_id: string | null;
  investment_id: string | null;
  monthly_target: number | null;
  contribution_frequency: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type IncomePlanPaycheckEventRow = {
  id: string;
  income_plan_id: string;
  user_id: string;
  household_id: string | null;
  pay_date: string;
  gross_amount: number;
  is_extra_paycheck: boolean;
  income_transaction_id: string | null;
  created_at: string;
};

export type IncomePlanAllocationEventRow = {
  id: string;
  paycheck_event_id: string;
  allocation_id: string;
  user_id: string;
  amount: number;
  transaction_id: string | null;
  created_at: string;
};

export type EnvelopeBalanceRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  allocation_id: string | null;
  envelope_type: string;
  entity_id: string | null;
  name: string;
  icon: string;
  balance: number;
  target: number | null;
  contribution_amount: number | null;
  contribution_frequency: string | null;
  progress: number;
  next_contribution_date: string | null;
  history: unknown;
  created_at: string;
  updated_at: string;
};

export type AllocationLedgerRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  paycheck_event_id: string | null;
  allocation_id: string | null;
  source_account_id: string | null;
  destination_type: string;
  destination_id: string | null;
  destination_name: string;
  amount: number;
  transfer_date: string;
  frequency: string | null;
  transaction_id: string | null;
  entry_type: string;
  created_at: string;
};

export type AdminFeedbackReportRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  report_type: "feedback" | "bug" | "feature_request";
  message: string;
  screenshot_url: string | null;
  recording_url: string | null;
  browser: string | null;
  page_path: string | null;
  category: string | null;
  device: string | null;
  app_version: string | null;
  status: "new" | "investigating" | "planned" | "in_progress" | "completed" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
};

export type AdminEventLogRow = {
  id: string;
  event_type: "error" | "stripe" | "plaid" | "auth" | "api_failure" | "ai_team";
  message: string;
  metadata: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
};

export type AiTeamRunSource = "ai" | "fallback";

export type AiTeamRunRow = {
  id: string;
  created_by: string | null;
  goal: string;
  source: AiTeamRunSource;
  model: string | null;
  summary: string;
  snapshot: Json;
  runtime_metadata: Json | null;
  created_at: string;
};

export type AiTeamRunInsert = {
  id?: string;
  created_by?: string | null;
  goal: string;
  source: AiTeamRunSource;
  model?: string | null;
  summary: string;
  snapshot: Json;
  runtime_metadata?: Json | null;
  created_at?: string;
};

export type AiTeamRunUpdate = Partial<AiTeamRunInsert>;

export type AiTeamTaskOwner =
  | "chief_of_staff"
  | "engineering"
  | "qa"
  | "analytics"
  | "product"
  | "growth"
  | "customer"
  | "critic";

export type AiTeamTaskStatusRow =
  | "queued"
  | "running"
  | "needs_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type AiTeamTaskRow = {
  id: string;
  run_id: string;
  owner: AiTeamTaskOwner;
  status: AiTeamTaskStatusRow;
  title: string;
  objective: string;
  evidence: Json;
  requires_approval: boolean;
  approval_reason: string | null;
  created_at: string;
};

export type AiTeamTaskInsert = {
  id?: string;
  run_id: string;
  owner: AiTeamTaskOwner;
  status: AiTeamTaskStatusRow;
  title: string;
  objective: string;
  evidence?: Json;
  requires_approval?: boolean;
  approval_reason?: string | null;
  created_at?: string;
};

export type AiTeamTaskUpdate = Partial<AiTeamTaskInsert>;

export type AiTeamActivityStatus =
  | "pending"
  | "running"
  | "completed"
  | "warning"
  | "failed";

export type AiTeamActivityEventRow = {
  id: string;
  operation_id: string;
  created_by: string;
  run_id: string | null;
  agent_id: AiTeamTaskOwner | null;
  phase: string;
  status: AiTeamActivityStatus;
  label: string;
  detail: string | null;
  ordinal: number;
  created_at: string;
};

export type AiTeamActivityEventInsert = {
  id?: string;
  operation_id: string;
  created_by: string;
  run_id?: string | null;
  agent_id?: AiTeamTaskOwner | null;
  phase: string;
  status: AiTeamActivityStatus;
  label: string;
  detail?: string | null;
  ordinal: number;
  created_at?: string;
};

export type AiTeamActivityEventUpdate = Pick<
  Partial<AiTeamActivityEventInsert>,
  "run_id"
>;

export type AiTeamApprovalDecisionRow = {
  id: string;
  task_id: string;
  run_id: string;
  actor_id: string;
  actor_email: string | null;
  decision: "approved" | "rejected";
  note: string | null;
  created_at: string;
};

export type AiTeamApprovalDecisionInsert = {
  id?: string;
  task_id: string;
  run_id: string;
  actor_id: string;
  actor_email?: string | null;
  decision: "approved" | "rejected";
  note?: string | null;
  created_at?: string;
};

export type AiTeamPlaybookRow = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  category: string;
  goal_template: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type AiTeamPlaybookInsert = {
  id?: string;
  created_by: string;
  title: string;
  description?: string;
  category: string;
  goal_template: string;
  favorite?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AiTeamExecutionPacketStatus =
  | "staged"
  | "claimed"
  | "completed"
  | "failed";

export type AiTeamExecutionPacketRow = {
  id: string;
  task_id: string;
  run_id: string;
  approval_decision_id: string;
  created_by: string;
  status: AiTeamExecutionPacketStatus;
  task_snapshot: Json;
  run_snapshot: Json;
  approval_snapshot: Json;
  evidence: Json;
  proposed_branch_name: string;
  implementation_brief: string;
  validation_checklist: Json;
  rollback_notes: string;
  requires_external_operator: true;
  created_at: string;
  updated_at: string;
};

export type AiTeamExecutionPacketInsert = {
  id?: string;
  task_id: string;
  run_id: string;
  approval_decision_id: string;
  created_by: string;
  status?: AiTeamExecutionPacketStatus;
  task_snapshot: Json;
  run_snapshot: Json;
  approval_snapshot: Json;
  evidence?: Json;
  proposed_branch_name: string;
  implementation_brief: string;
  validation_checklist: Json;
  rollback_notes: string;
  requires_external_operator?: true;
  created_at?: string;
  updated_at?: string;
};

export type AiTeamFounderBriefRow = {
  id: string;
  brief_date: string;
  generated_by: string;
  source: "deterministic" | "ai";
  snapshot: Json;
  sections: Json;
  created_at: string;
  updated_at: string;
};

export type AiTeamFounderBriefInsert = {
  id?: string;
  brief_date: string;
  generated_by: string;
  source?: "deterministic" | "ai";
  snapshot: Json;
  sections: Json;
  created_at?: string;
  updated_at?: string;
};

export type BetaSettingsRow = {
  id: number;
  invite_only: boolean;
  max_beta_users: number | null;
  waitlist_enabled: boolean;
  updated_at: string;
};

export type BetaWaitlistRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseChangeCategoryRow =
  | "feature"
  | "improvement"
  | "bugfix"
  | "security"
  | "performance";

export type AppReleaseRow = {
  id: string;
  version: string;
  release_date: string;
  title: string;
  summary: string;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type AppReleaseChangeRow = {
  id: string;
  release_id: string;
  category: ReleaseChangeCategoryRow;
  description: string;
  sort_order: number;
  created_at: string;
};

export type UserReleaseViewRow = {
  user_id: string;
  release_id: string;
  viewed_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      accounts: {
        Row: AccountRow;
        Insert: AccountInsert;
        Update: AccountUpdate;
        Relationships: [];
      };
      bills: {
        Row: BillRow;
        Insert: BillInsert;
        Update: BillUpdate;
        Relationships: [];
      };
      bill_splits: {
        Row: BillSplitRow;
        Insert: BillSplitInsert;
        Update: BillSplitUpdate;
        Relationships: [];
      };
      goals: {
        Row: GoalRow;
        Insert: GoalInsert;
        Update: GoalUpdate;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: TransactionInsert;
        Update: TransactionUpdate;
        Relationships: [];
      };
      investments: {
        Row: InvestmentRow;
        Insert: InvestmentInsert;
        Update: InvestmentUpdate;
        Relationships: [];
      };
      recurring_items: {
        Row: RecurringItemRow;
        Insert: RecurringItemInsert;
        Update: RecurringItemUpdate;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
        Relationships: [];
      };
      households: {
        Row: HouseholdRow;
        Insert: HouseholdInsert;
        Update: HouseholdUpdate;
        Relationships: [];
      };
      household_members: {
        Row: HouseholdMemberRow;
        Insert: HouseholdMemberInsert;
        Update: Partial<HouseholdMemberInsert>;
        Relationships: [];
      };
      household_invites: {
        Row: HouseholdInviteRow;
        Insert: HouseholdInviteInsert;
        Update: Partial<HouseholdInviteInsert>;
        Relationships: [];
      };
      bank_connections: {
        Row: BankConnectionRow;
        Insert: BankConnectionInsert;
        Update: Partial<BankConnectionInsert>;
        Relationships: [];
      };
      plaid_recurring_dismissals: {
        Row: PlaidRecurringDismissalRow;
        Insert: PlaidRecurringDismissalInsert;
        Update: Partial<PlaidRecurringDismissalInsert>;
        Relationships: [];
      };
      income_plans: {
        Row: IncomePlanRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      income_plan_allocations: {
        Row: IncomePlanAllocationRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      income_plan_paycheck_events: {
        Row: IncomePlanPaycheckEventRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      income_plan_allocation_events: {
        Row: IncomePlanAllocationEventRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      envelope_balances: {
        Row: EnvelopeBalanceRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      allocation_ledger: {
        Row: AllocationLedgerRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_feedback_reports: {
        Row: AdminFeedbackReportRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_event_logs: {
        Row: AdminEventLogRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      ai_team_runs: {
        Row: AiTeamRunRow;
        Insert: AiTeamRunInsert;
        Update: AiTeamRunUpdate;
        Relationships: [];
      };
      ai_team_activity_events: {
        Row: AiTeamActivityEventRow;
        Insert: AiTeamActivityEventInsert;
        Update: AiTeamActivityEventUpdate;
        Relationships: [
          {
            foreignKeyName: "ai_team_activity_events_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ai_team_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_team_approval_decisions: {
        Row: AiTeamApprovalDecisionRow;
        Insert: AiTeamApprovalDecisionInsert;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ai_team_approval_decisions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "ai_team_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_team_approval_decisions_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ai_team_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_team_playbooks: {
        Row: AiTeamPlaybookRow;
        Insert: AiTeamPlaybookInsert;
        Update: Partial<AiTeamPlaybookInsert>;
        Relationships: [];
      };
      ai_team_execution_packets: {
        Row: AiTeamExecutionPacketRow;
        Insert: AiTeamExecutionPacketInsert;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ai_team_execution_packets_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "ai_team_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_team_execution_packets_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ai_team_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_team_execution_packets_approval_decision_id_fkey";
            columns: ["approval_decision_id"];
            isOneToOne: true;
            referencedRelation: "ai_team_approval_decisions";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_team_founder_briefs: {
        Row: AiTeamFounderBriefRow;
        Insert: AiTeamFounderBriefInsert;
        Update: Partial<AiTeamFounderBriefInsert>;
        Relationships: [];
      };
      ai_team_tasks: {
        Row: AiTeamTaskRow;
        Insert: AiTeamTaskInsert;
        Update: AiTeamTaskUpdate;
        Relationships: [
          {
            foreignKeyName: "ai_team_tasks_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ai_team_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      beta_settings: {
        Row: BetaSettingsRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      beta_waitlist: {
        Row: BetaWaitlistRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      app_releases: {
        Row: AppReleaseRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      app_release_changes: {
        Row: AppReleaseChangeRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_release_views: {
        Row: UserReleaseViewRow;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_ai_team_approval_decision: {
        Args: {
          p_task_id: string;
          p_actor_id: string;
          p_actor_email: string;
          p_decision: "approved" | "rejected";
          p_note: string;
        };
        Returns: AiTeamApprovalDecisionRow[];
      };
      stage_ai_team_execution_packet: {
        Args: {
          p_task_id: string;
          p_created_by: string;
          p_proposed_branch_name: string;
          p_implementation_brief: string;
          p_validation_checklist: Json;
          p_rollback_notes: string;
        };
        Returns: AiTeamExecutionPacketRow[];
      };
      save_ai_team_run_atomic: {
        Args: {
          p_created_by: string;
          p_goal: string;
          p_source: string;
          p_model: string | null;
          p_summary: string;
          p_snapshot: Json;
          p_created_at: string;
          p_tasks: Json;
          p_runtime_metadata?: Json | null;
        };
        Returns: string;
      };
      accept_household_invite: {
        Args: { p_invite_id: string };
        Returns: string;
      };
      get_household_invite_by_token: {
        Args: { p_token: string };
        Returns: Record<string, unknown> | null;
      };
      leave_household: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      remove_household_member: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      transfer_household_ownership: {
        Args: { p_new_owner_id: string };
        Returns: undefined;
      };
      revoke_household_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      profile_privilege_guard_active: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      user_household_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: {
      account_record_kind: AccountRecordKind;
      transaction_type: TransactionType;
      recurring_entity_type: RecurringEntityType;
    };
    CompositeTypes: Record<string, never>;
  };
};
