import "server-only";

import {
  collectCashAccounts,
  collectUniqueDebtBalances,
  collectUniqueInvestmentValues,
} from "@/lib/calculations/balanceAggregation";
import { calculateAvailableCash } from "@/lib/calculations/availableCash";
import {
  calculateMonthlyIncome,
  calculateMonthlySpending,
  calculateNetWorthBreakdown,
} from "@/lib/calculations";
import {
  calculateMonthlySpendingFromLedger,
  recurringBillMonthlyTotal,
  sumBillMatchedExpenses,
} from "@/lib/calculations/spending";
import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import { diagnoseIncomeCalculation } from "@/lib/finance/personalIncomeScope";
import { getPlaidClient } from "@/lib/plaid/plaidClient";
import { decryptConnectionAccessToken } from "@/lib/plaid/plaidService";
import { syncPlaidForUser } from "@/lib/plaid/syncService";
import {
  getOverdueBillDiagnostics,
  type BillCycleDiagnostic,
} from "@/lib/bills/reconcileBillPayments";
import {
  loadBillPaymentDiagnosticsForUser,
  reconcileBillPaymentsForUser,
} from "@/lib/bills/persistBillReconciliation";
import { getBillProgressList } from "@/lib/finance/bills";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { FinanceService } from "@/lib/supabase/services/financeService";

export type FinanceAuditMetric = {
  id: string;
  label: string;
  rawSources: unknown;
  formula: string;
  displayed: number;
};

export type FinanceAuditIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  details?: unknown;
};

export type FinanceAuditResult = {
  userId: string;
  email: string | null;
  plaidConnectionsSynced: number;
  metrics: FinanceAuditMetric[];
  issues: FinanceAuditIssue[];
  billDiagnostics?: BillCycleDiagnostic[];
  overdueBills?: Array<{
    billId: string;
    billName: string;
    splitId: string;
    dueDate: string | null;
    amount: number;
    cycleMonth: string;
    linkedPaymentTotal: number;
    unpaidReason: string;
  }>;
  recomputedAt: string;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function findDuplicateExternalIds(
  rows: Array<{ id: string; name: string; externalAccountId?: string | null }>,
): FinanceAuditIssue[] {
  const groups = new Map<string, typeof rows>();

  for (const row of rows) {
    if (!row.externalAccountId) continue;
    const existing = groups.get(row.externalAccountId) ?? [];
    existing.push(row);
    groups.set(row.externalAccountId, existing);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([externalAccountId, items]) => ({
      severity: "error" as const,
      code: "duplicate_external_account",
      message: `Duplicate linked accounts for external id ${externalAccountId}`,
      details: items,
    }));
}

async function fetchPlaidBalances(adminSupabase: BuxmeSupabaseClient, userId: string) {
  const { data: connections, error } = await adminSupabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const client = getPlaidClient();
  const snapshots: Array<{
    connectionId: string;
    institutionName: string | null;
    accounts: Array<{
      externalAccountId: string;
      name: string;
      type: string;
      current: number | null;
      available: number | null;
    }>;
  }> = [];

  for (const connection of connections ?? []) {
    if (!connection.access_token_encrypted) {
      continue;
    }

    try {
      const accessToken = decryptConnectionAccessToken(connection);
      const response = await client.accountsGet({ access_token: accessToken });
      snapshots.push({
        connectionId: connection.id,
        institutionName: connection.institution_name,
        accounts: response.data.accounts.map((account) => ({
          externalAccountId: account.account_id,
          name: account.name,
          type: account.type,
          current: account.balances.current,
          available: account.balances.available,
        })),
      });
    } catch (syncError) {
      snapshots.push({
        connectionId: connection.id,
        institutionName: connection.institution_name,
        accounts: [],
      });
      console.error("[finance-audit] Plaid accountsGet failed", {
        userId,
        connectionId: connection.id,
        syncError,
      });
    }
  }

  return snapshots;
}

export async function auditUserFinance(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<FinanceAuditResult | null> {
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return null;
  }

  const financeService = new FinanceService(adminSupabase);
  const financeData = await financeService.loadFinanceData(userId);
  const breakdown = calculateNetWorthBreakdown(financeData);
  const moneyFlow = calculateMoneyFlow(financeData);
  const incomeDiagnostics = diagnoseIncomeCalculation(financeData);
  const plaidSnapshots = await fetchPlaidBalances(adminSupabase, userId);
  const billProgress = getBillProgressList(financeData);
  const overdueBills = billProgress.filter((bill) => bill.status === "overdue");
  const overdueAmount = overdueBills.reduce(
    (total, bill) => total + bill.remainingAmount,
    0,
  );
  const billsDue = billProgress
    .filter((bill) => bill.status !== "paid")
    .reduce((total, bill) => total + bill.remainingAmount, 0);
  const billsPaid = billProgress
    .filter((bill) => bill.status === "paid")
    .reduce((total, bill) => total + bill.paidAmount, 0);
  const billPaymentDiagnostics = await loadBillPaymentDiagnosticsForUser(
    adminSupabase,
    userId,
  );
  const overdueDiagnostics = getOverdueBillDiagnostics(financeData);

  const cashItems = collectCashAccounts(financeData);
  const debtItems = collectUniqueDebtBalances(financeData);
  const investmentItems = collectUniqueInvestmentValues(financeData);

  const issues: FinanceAuditIssue[] = [
    ...findDuplicateExternalIds(financeData.accounts ?? []),
    ...findDuplicateExternalIds(financeData.debts ?? []),
    ...findDuplicateExternalIds(financeData.investments ?? []),
  ];

  const duplicateTransactions = new Map<string, number>();
  for (const transaction of financeData.transactions ?? []) {
    if (!transaction.externalTransactionId) continue;
    duplicateTransactions.set(
      transaction.externalTransactionId,
      (duplicateTransactions.get(transaction.externalTransactionId) ?? 0) + 1,
    );
  }

  for (const [externalTransactionId, count] of duplicateTransactions.entries()) {
    if (count > 1) {
      issues.push({
        severity: "error",
        code: "duplicate_external_transaction",
        message: `Duplicate Plaid transaction ${externalTransactionId}`,
        details: { count },
      });
    }
  }

  const recurringBills = recurringBillMonthlyTotal(financeData);
  const ledgerSpending = calculateMonthlySpendingFromLedger(financeData);
  const matchedBillExpenses = sumBillMatchedExpenses(financeData);

  if (recurringBills > 0 && matchedBillExpenses > 0) {
    issues.push({
      severity: "warning",
      code: "bill_expense_overlap",
      message:
        "Recurring bills overlap with current-month expense transactions (now deduped in Safe To Spend).",
      details: {
        recurringBills: round(recurringBills),
        matchedBillExpenses: round(matchedBillExpenses),
        ledgerSpending: round(ledgerSpending),
      },
    });
  }

  for (const snapshot of plaidSnapshots) {
    for (const plaidAccount of snapshot.accounts) {
      const dbAccount = [...(financeData.accounts ?? []), ...(financeData.debts ?? [])].find(
        (row) => row.externalAccountId === plaidAccount.externalAccountId,
      );
      const dbInvestment = (financeData.investments ?? []).find(
        (row) => row.externalAccountId === plaidAccount.externalAccountId,
      );

      const isDebt =
        plaidAccount.type === "credit" || plaidAccount.type === "loan";
      const expected = isDebt
        ? Math.abs(Number(plaidAccount.current ?? 0))
        : Number(plaidAccount.current ?? 0);

      const dbBalance = dbAccount
        ? dbAccount.balance
        : dbInvestment
          ? dbInvestment.value
          : null;

      if (dbBalance === null) {
        issues.push({
          severity: "error",
          code: "missing_plaid_account",
          message: `Plaid account ${plaidAccount.name} is not stored in Buxme`,
          details: plaidAccount,
        });
        continue;
      }

      if (Math.abs(dbBalance - expected) > 1) {
        issues.push({
          severity: "error",
          code: "plaid_balance_mismatch",
          message: `Balance mismatch for ${plaidAccount.name}`,
          details: {
            externalAccountId: plaidAccount.externalAccountId,
            plaidCurrent: plaidAccount.current,
            expected,
            stored: dbBalance,
            delta: round(dbBalance - expected),
          },
        });
      }
    }
  }

  if (overdueBills.length > 0) {
    issues.push({
      severity: "warning",
      code: "overdue_bills",
      message: `${overdueBills.length} bill${overdueBills.length === 1 ? "" : "s"} marked overdue`,
      details: overdueBills.map((bill) => ({
        billId: bill.billId,
        name: bill.name,
        amount: round(bill.remainingAmount),
        dueDate: bill.formattedDueDate,
      })),
    });
  }

  const metrics: FinanceAuditMetric[] = [
    {
      id: "cash",
      label: "Available Cash",
      rawSources: cashItems.map((account) => ({
        name: account.name,
        balance: account.balance,
        available: account.availableBalance,
      })),
      formula: "sum(visible cash accounts included in net worth)",
      displayed: round(breakdown.cash.value),
    },
    {
      id: "investments",
      label: "Investments",
      rawSources: investmentItems.items,
      formula: "deduped investments table + investment accounts by external_account_id",
      displayed: round(breakdown.investments.value),
    },
    {
      id: "debt",
      label: "Debt / Liabilities",
      rawSources: debtItems.items,
      formula: "deduped debt rows + credit_card accounts by external_account_id",
      displayed: round(breakdown.debt.value),
    },
    {
      id: "net_worth",
      label: "Net Worth",
      rawSources: {
        cash: breakdown.cash.value,
        investments: breakdown.investments.value,
        debt: breakdown.debt.value,
      },
      formula: "cash + investments - debt",
      displayed: round(breakdown.netWorth.value),
    },
    {
      id: "monthly_income",
      label: "Monthly Income",
      rawSources: incomeDiagnostics.streams,
      formula:
        incomeDiagnostics.calculationMode === "recurring_sources"
          ? "deduped personal recurring income (+ income plan when applicable)"
          : "personal ledger income for current month",
      displayed: round(calculateMonthlyIncome(financeData)),
    },
    {
      id: "monthly_spending",
      label: "Monthly Spending (Money Flow)",
      rawSources: {
        recurringBills: round(recurringBills),
        ledgerSpending: round(ledgerSpending),
        matchedBillExpenses: round(matchedBillExpenses),
      },
      formula: "recurring bills + discretionary ledger expenses (bill duplicates excluded)",
      displayed: round(calculateMonthlySpending(financeData)),
    },
    {
      id: "safe_to_spend",
      label: "Safe To Spend",
      rawSources: {
        breakdown: moneyFlow.breakdown,
        availableCash: round(calculateAvailableCash(financeData)),
      },
      formula:
        "min(income - bills - debts - goals - investments, available cash) when Plaid cash linked",
      displayed: round(moneyFlow.safeToSpend),
    },
    {
      id: "bills_due",
      label: "Bills Due (unpaid)",
      rawSources: billProgress.filter((bill) => bill.status !== "paid"),
      formula: "sum(remainingAmount for non-paid bill cycles)",
      displayed: round(billsDue),
    },
    {
      id: "bills_paid",
      label: "Bills Paid (current cycles)",
      rawSources: billProgress.filter((bill) => bill.status === "paid"),
      formula: "sum(paidAmount for paid bill cycles)",
      displayed: round(billsPaid),
    },
    {
      id: "overdue_amount",
      label: "Overdue Amount",
      rawSources: overdueBills,
      formula: "sum(remainingAmount where status=overdue)",
      displayed: round(overdueAmount),
    },
  ];

  return {
    userId,
    email: profile.email,
    plaidConnectionsSynced: 0,
    metrics,
    issues,
    billDiagnostics: billPaymentDiagnostics.filter(
      (entry) => entry.statusAfter === "unpaid" || entry.matchedTransactionId,
    ),
    overdueBills: overdueDiagnostics,
    recomputedAt: new Date().toISOString(),
  };
}

export async function refreshUserFinanceAudit(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<FinanceAuditResult | null> {
  const financeService = new FinanceService(adminSupabase);
  const financeData = await financeService.loadFinanceData(userId);

  let synced = 0;

  for (const connection of financeData.bankConnections ?? []) {
    if (connection.status === "disconnected") {
      continue;
    }

    try {
      await syncPlaidForUser({
        supabase: adminSupabase,
        userId,
        connectionId: connection.id,
      });
      synced += 1;
    } catch (error) {
      console.error("[finance-audit] Plaid sync failed", {
        userId,
        connectionId: connection.id,
        error,
      });
    }
  }

  try {
    await reconcileBillPaymentsForUser(adminSupabase, userId);
  } catch (error) {
    console.error("[finance-audit] bill reconciliation failed", { userId, error });
  }

  const result = await auditUserFinance(adminSupabase, userId);

  if (!result) {
    return null;
  }

  return {
    ...result,
    plaidConnectionsSynced: synced,
  };
}
