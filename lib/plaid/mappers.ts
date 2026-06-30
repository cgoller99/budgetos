import type { AccountSubtype, AccountType as PlaidAccountType, Transaction } from "plaid";
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

function mapPlaidAccountType(
  type: PlaidAccountType,
  subtype: AccountSubtype | null,
): { accountType: string; recordKind: PlaidMappedAccount["recordKind"] } {
  if (type === "credit") {
    return { accountType: "credit_card", recordKind: "debt" };
  }

  if (type === "loan") {
    return { accountType: "credit_card", recordKind: "debt" };
  }

  if (type === "investment" || type === "brokerage") {
    return { accountType: "investment", recordKind: "investment" };
  }

  if (subtype === "savings" || subtype === "money market" || subtype === "cd") {
    return { accountType: "savings", recordKind: "account" };
  }

  return { accountType: "checking", recordKind: "account" };
}

function inferDebtAccountType(name: string): DebtAccountType {
  const normalized = name.toLowerCase();

  if (normalized.includes("student")) return "student_loan";
  if (normalized.includes("auto") || normalized.includes("car")) return "auto_loan";
  if (normalized.includes("mortgage") || normalized.includes("home")) return "mortgage";
  if (normalized.includes("medical")) return "medical";
  if (normalized.includes("credit")) return "credit_card";

  return "other";
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
  const balance = Math.abs(toNumber(account.balances.current));
  const availableBalance =
    account.balances.available === null
      ? null
      : Math.abs(toNumber(account.balances.available));

  const result: PlaidMappedAccount = {
    externalAccountId: account.account_id,
    externalItemId: itemId,
    name: account.name.trim() || account.official_name?.trim() || "Account",
    officialName: account.official_name ?? null,
    institution: institutionName,
    institutionLogoUrl,
    type: mapped.accountType,
    recordKind: mapped.recordKind,
    balance,
    availableBalance,
    lastFour: account.mask ?? null,
  };

  if (mapped.recordKind === "debt") {
    result.type = inferDebtAccountType(result.name);
    result.originalBalance = balance;
    result.minimumPayment = null;
    result.interestRate = null;
    result.dueDay = 1;
  }

  return result;
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

export function mapPlaidTransaction(
  transaction: Transaction,
): PlaidMappedTransaction {
  const amount = toNumber(transaction.amount);
  const isIncome = amount < 0;
  const normalizedAmount = Math.abs(amount);
  const merchantName =
    transaction.merchant_name?.trim() ||
    transaction.name?.trim() ||
    "Transaction";

  return {
    externalTransactionId: transaction.transaction_id,
    externalAccountId: transaction.account_id,
    amount: normalizedAmount,
    type: isIncome ? "income" : "expense",
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
