export type PlaidSyncScope = "connection" | "all";

export type PlaidLinkMode = "create" | "update";

export type PlaidSyncResult = {
  connectionId: string;
  accountsSynced: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  investmentsSynced: number;
  liabilitiesSynced: number;
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
