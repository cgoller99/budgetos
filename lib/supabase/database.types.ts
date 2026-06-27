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
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
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
  created_at?: string;
  updated_at?: string;
};

export type BillUpdate = Partial<BillInsert>;

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
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
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
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_record_kind: AccountRecordKind;
      transaction_type: TransactionType;
      recurring_entity_type: RecurringEntityType;
    };
    CompositeTypes: Record<string, never>;
  };
};
