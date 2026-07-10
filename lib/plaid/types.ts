export type PlaidSyncScope = "connection" | "all";

export type PlaidLinkMode = "create" | "update";

export type PlaidTransactionSkipReason = "missing_account_map";

export type PlaidSyncAccountSummary = {
  externalAccountId: string;
  internalAccountId: string;
  name: string;
  recordKind: PlaidMappedAccount["recordKind"];
  type: string;
  lastFour: string | null;
  balance: number;
  institution: string;
  isNew: boolean;
};

export type PlaidSyncDiagnostics = {
  connectionId: string;
  itemId: string | null;
  accounts: PlaidSyncAccountSummary[];
  plaid: {
    fetchedFromPlaid: number;
    addedFromPlaid: number;
    modifiedFromPlaid: number;
    removedFromPlaid: number;
    pending: boolean;
    pendingError: string | null;
    refreshRequested: boolean;
    syncAttempts: number;
  };
  persisted: {
    inserted: number;
    updated: number;
    deleted: number;
    skipped: Array<{ reason: PlaidTransactionSkipReason; count: number }>;
  };
  database: {
    transactionCountByAccountId: Record<string, number>;
  };
  backfill?: {
    accountsRequested: number;
    fetchedFromPlaid: number;
    inserted: number;
    updated: number;
    skipped: Array<{ reason: PlaidTransactionSkipReason; count: number }>;
    error: string | null;
  };
};

export type PlaidSyncResult = {
  connectionId: string;
  accountsSynced: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  investmentsSynced: number;
  liabilitiesSynced: number;
  diagnostics?: PlaidSyncDiagnostics;
};

export type PlaidUserDiagnostics = {
  ok: true;
  connections: number;
  items: Array<{
    connectionId: string;
    institutionName: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    lastSyncedAt: string | null;
    accounts: Array<{
      id: string;
      name: string;
      recordKind: string;
      type: string;
      lastFour: string | null;
      balance: number;
      institution: string;
      transactionCount: number;
    }>;
  }>;
};

export type PlaidMappedAccount = {
  externalAccountId: string;
  externalItemId: string;
  name: string;
  officialName: string | null;
  institution: string;
  institutionLogoUrl: string | null;
  type: string;
  recordKind: "account" | "debt" | "investment";
  balance: number;
  availableBalance: number | null;
  lastFour: string | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  dueDay?: number | null;
  originalBalance?: number | null;
};

export type PlaidMappedTransaction = {
  externalTransactionId: string;
  externalAccountId: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  date: string;
  notes: string;
  name: string;
};

export type PlaidRecurringCandidate = {
  merchantKey: string;
  displayName: string;
  averageAmount: number;
  dueDay: number;
  category: string;
  transactionIds: string[];
};

export type PlaidPayrollCandidate = {
  transactionId: string;
  amount: number;
  postedDate: string;
  confidence: number;
};
