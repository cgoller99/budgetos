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
  is_remaining_balance: boolean;
  account_id: string | null;
  goal_id: string | null;
  monthly_target: number | null;
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
    };
    Views: Record<string, never>;
    Functions: {
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
