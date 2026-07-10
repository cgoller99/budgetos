import type { AccountSubtype, AccountType as PlaidAccountType, Transaction } from "plaid";
import { inferDebtAccountType } from "@/lib/finance/debts";
import type { DebtAccountType } from "@/lib/finance/types";
import type {
  PlaidMappedAccount,
  PlaidMappedTransaction,
  PlaidPayrollCandidate,
  PlaidRecurringCandidate,
} from "@/lib/plaid/types";

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function normalizeLastFour(mask: string | null | undefined): string | null {
  if (!mask) {
    return null;
  }

  const digits = mask.replace(/\D/g, "");

  if (digits.length === 0) {
    return null;
  }

  return digits.length >= 4 ? digits.slice(-4) : digits;
}

function mapLoanSubtype(subtype: AccountSubtype | null): DebtAccountType {
  switch (subtype) {
    case "student":
      return "student_loan";
    case "mortgage":
      return "mortgage";
    case "auto":
      return "auto_loan";
    default:
      return "other";
  }
}

function mapPlaidAccountType(
  type: PlaidAccountType,
  subtype: AccountSubtype | null,
): { accountType: string; recordKind: PlaidMappedAccount["recordKind"] } {
  if (type === "credit") {
    return { accountType: "credit_card", recordKind: "debt" };
  }

  if (type === "loan") {
    return { accountType: "other", recordKind: "debt" };
  }

  if (type === "investment" || type === "brokerage") {
    return { accountType: "investment", recordKind: "investment" };
  }

  if (
    subtype === "savings" ||
    subtype === "money market" ||
    subtype === "cd" ||
    subtype === "hsa" ||
    subtype === "cash management"
  ) {
    return { accountType: "savings", recordKind: "account" };
  }

  return { accountType: "checking", recordKind: "account" };
}

function mapPlaidBalances(
  type: PlaidAccountType,
  balances: {
    current: number | null;
    available: number | null;
  },
): { balance: number; availableBalance: number | null } {
  const isDebt = type === "credit" || type === "loan";
  const current = toNumber(balances.current);

  return {
    balance: isDebt ? Math.abs(current) : current,
    availableBalance:
      balances.available === null
        ? null
        : isDebt
          ? Math.abs(toNumber(balances.available))
          : toNumber(balances.available),
  };
}

function resolveAccountName(account: {
  name: string;
  official_name?: string | null;
}): string {
  const official = account.official_name?.trim();
  const name = account.name.trim();

  return official || name || "Account";
}

function resolveDebtAccountType(
  account: {
    type: PlaidAccountType;
    subtype: AccountSubtype | null;
    name: string;
    official_name?: string | null;
  },
): DebtAccountType {
  if (account.type === "credit") {
    return "credit_card";
  }

  if (account.type === "loan") {
    const fromSubtype = mapLoanSubtype(account.subtype);
    if (fromSubtype !== "other") {
      return fromSubtype;
    }
  }

  return inferDebtAccountType(
    resolveAccountName(account),
  );
}

export function mapPlaidAccount(params: {
  account: {
    account_id: string;
    name: string;
    official_name?: string | null;
    type: PlaidAccountType;
    subtype: AccountSubtype | null;
    mask?: string | null;
    balances: {
      current: number | null;
      available: number | null;
    };
  };
  itemId: string;
  institutionName: string;
  institutionLogoUrl: string | null;
}): PlaidMappedAccount {
  const { account, itemId, institutionName, institutionLogoUrl } = params;
  const mapped = mapPlaidAccountType(account.type, account.subtype);
  const { balance, availableBalance } = mapPlaidBalances(
    account.type,
    account.balances,
  );
  const displayName = resolveAccountName(account);
  const safeInstitution =
    institutionName.trim() && !institutionName.startsWith("ins_")
      ? institutionName.trim()
      : "Linked institution";

  const result: PlaidMappedAccount = {
    externalAccountId: account.account_id,
    externalItemId: itemId,
    name: displayName || (safeInstitution !== "Linked institution"
      ? `${safeInstitution} account`
      : "Account"),
    officialName: account.official_name ?? null,
    institution: safeInstitution,
    institutionLogoUrl,
    type: mapped.accountType,
    recordKind: mapped.recordKind,
    balance,
    availableBalance:
      mapped.recordKind === "debt" ? null : availableBalance,
    lastFour: normalizeLastFour(account.mask),
  };

  if (mapped.recordKind === "debt") {
    result.type = resolveDebtAccountType(account);
    result.originalBalance = balance;
    result.minimumPayment = null;
    result.interestRate = null;
    result.dueDay = 1;
  }

  return result;
}

export function summarizePlaidAccountMapping(params: {
  userId: string;
  connectionId: string;
  itemId: string;
  accounts: PlaidMappedAccount[];
}): void {
  console.info("[plaid/mapping] account ownership validation", {
    userId: params.userId,
    connectionId: params.connectionId,
    itemId: params.itemId,
    accountCount: params.accounts.length,
    accounts: params.accounts.map((account) => ({
      externalAccountId: account.externalAccountId,
      recordKind: account.recordKind,
      type: account.type,
      institution: account.institution,
      name: account.name,
      lastFour: account.lastFour ? `****${account.lastFour}` : null,
      balance: account.balance,
    })),
  });
}

function mapPlaidCategory(transaction: Transaction): string {
  const primary = transaction.personal_finance_category?.primary;
  const detailed = transaction.personal_finance_category?.detailed;

  if (detailed) {
    return detailed
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (primary) {
    return primary
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return transaction.category?.[0] ?? "Uncategorized";
}

function resolvePlaidTransactionType(
  transaction: Transaction,
  accountContext?: Pick<PlaidMappedAccount, "recordKind" | "type">,
): PlaidMappedTransaction["type"] {
  const primary = transaction.personal_finance_category?.primary;
  const detailed = transaction.personal_finance_category?.detailed ?? "";

  if (
    primary === "TRANSFER_IN" ||
    primary === "TRANSFER_OUT" ||
    detailed.startsWith("TRANSFER_")
  ) {
    return "transfer";
  }

  const amount = toNumber(transaction.amount);
  const isCreditCard =
    accountContext?.recordKind === "debt" &&
    accountContext.type === "credit_card";

  if (isCreditCard) {
    if (amount <= 0) {
      return "transfer";
    }

    return "expense";
  }

  if (primary === "INCOME" || primary === "DEPOSIT") {
    return "income";
  }

  if (primary === "LOAN_PAYMENTS") {
    return "transfer";
  }

  return amount < 0 ? "income" : "expense";
}

export function mapPlaidTransaction(
  transaction: Transaction,
  accountContext?: Pick<PlaidMappedAccount, "recordKind" | "type">,
): PlaidMappedTransaction {
  const amount = toNumber(transaction.amount);
  const normalizedAmount = Math.abs(amount);
  const merchantName =
    transaction.merchant_name?.trim() ||
    transaction.name?.trim() ||
    "Transaction";

  return {
    externalTransactionId: transaction.transaction_id,
    externalAccountId: transaction.account_id,
    amount: normalizedAmount,
    type: resolvePlaidTransactionType(transaction, accountContext),
    category: mapPlaidCategory(transaction),
    date: transaction.date,
    notes: merchantName,
    name: merchantName,
  };
}

function normalizeMerchantKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function displayMerchantName(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function detectPlaidRecurringCandidates(
  transactions: PlaidMappedTransaction[],
): PlaidRecurringCandidate[] {
  const groups = new Map<string, PlaidMappedTransaction[]>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const merchantKey = normalizeMerchantKey(transaction.notes || transaction.name);

    if (merchantKey.length < 3) {
      continue;
    }

    const existing = groups.get(merchantKey) ?? [];
    existing.push(transaction);
    groups.set(merchantKey, existing);
  }

  const candidates: PlaidRecurringCandidate[] = [];

  for (const [merchantKey, items] of groups) {
    const monthKeys = new Set(items.map((item) => item.date.slice(0, 7)));

    if (monthKeys.size < 2 || items.length < 2) {
      continue;
    }

    const amounts = items.map((item) => item.amount);
    const average =
      amounts.reduce((total, amount) => total + amount, 0) / amounts.length;

    if (average <= 0) {
      continue;
    }

    const amountsSimilar = amounts.every(
      (amount) => Math.abs(amount - average) / average <= 0.15,
    );

    if (!amountsSimilar) {
      continue;
    }

    const days = items.map((item) => new Date(item.date).getDate());
    const averageDay =
      days.reduce((total, day) => total + day, 0) / days.length;
    const daysSimilar = days.every((day) => Math.abs(day - averageDay) <= 3);

    if (!daysSimilar) {
      continue;
    }

    candidates.push({
      merchantKey,
      displayName: displayMerchantName(merchantKey),
      averageAmount: Math.round(average * 100) / 100,
      dueDay: Math.min(28, Math.max(1, Math.round(averageDay))),
      category: items[0]?.category ?? "Subscriptions",
      transactionIds: items.map((item) => item.externalTransactionId),
    });
  }

  return candidates;
}

export function detectPlaidPayrollCandidates(params: {
  transactions: PlaidMappedTransaction[];
  paycheckAmount: number;
  depositAccountExternalId?: string | null;
  referenceDate?: Date;
}): PlaidPayrollCandidate[] {
  const {
    transactions,
    paycheckAmount,
    depositAccountExternalId,
    referenceDate = new Date(),
  } = params;

  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return transactions
    .filter((transaction) => {
      if (transaction.type !== "income" || transaction.date < cutoffDate) {
        return false;
      }

      if (
        depositAccountExternalId &&
        transaction.externalAccountId !== depositAccountExternalId
      ) {
        return false;
      }

      if (paycheckAmount <= 0) {
        return false;
      }

      return Math.abs(transaction.amount - paycheckAmount) / paycheckAmount <= 0.05;
    })
    .map((transaction) => ({
      transactionId: transaction.externalTransactionId,
      amount: transaction.amount,
      postedDate: transaction.date,
      confidence: 0.92,
    }));
}
