import { NextResponse } from "next/server";
import { refreshUserFinanceAudit } from "@/lib/admin/financeAuditService";
import { getAdminIncomeDiagnostics } from "@/lib/admin/incomeDiagnosticsService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  calculateAverageLedgerMonthlyIncome,
  calculateMonthlyIncome,
  calculateRecurringMonthlyIncome,
  getCurrentMonthLedgerIncomeTotal,
  getIncomeCalculationMode,
} from "@/lib/calculations/income";
import { filterRealIncomeTransactions } from "@/lib/transactions/transferDetection";
import { FinanceService } from "@/lib/supabase/services/financeService";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) {
      return true;
    }
  }

  // Vercel scheduled cron invocations (header alone is not sufficient off-platform).
  if (
    process.env.VERCEL === "1" &&
    request.headers.get("x-vercel-cron") === "1"
  ) {
    return true;
  }

  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const email = url.searchParams.get("email")?.trim();

  if (!userId && !email) {
    return NextResponse.json(
      { error: "Provide userId or email query parameter." },
      { status: 400 },
    );
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    let resolvedUserId = userId;

    if (!resolvedUserId && email) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (error) {
        throw error;
      }

      const match = data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!match) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      resolvedUserId = match.id;
    }

    const audit = await refreshUserFinanceAudit(adminSupabase, resolvedUserId!);

    if (!audit) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const incomeDiagnostics = await getAdminIncomeDiagnostics(
      adminSupabase,
      resolvedUserId!,
    );
    const financeService = new FinanceService(adminSupabase);
    const financeData = await financeService.loadFinanceData(resolvedUserId!);
    const referenceDate = new Date();
    const monthKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;

    const ledgerMonths = [];
    for (let offset = 0; offset <= 3; offset += 1) {
      const date = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() - offset,
        15,
      );
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const raw = (financeData.transactions ?? []).filter(
        (transaction) =>
          transaction.type === "income" &&
          (transaction.date ?? "").startsWith(month),
      );
      const filtered = filterRealIncomeTransactions(financeData, raw);
      ledgerMonths.push({
        month,
        rawTotal: Math.round(raw.reduce((total, row) => total + row.amount, 0) * 100) / 100,
        filteredTotal: Math.round(
          filtered.reduce((total, row) => total + row.amount, 0) * 100,
        ) / 100,
        excludedCount: raw.length - filtered.length,
        topDeposits: filtered
          .sort((left, right) => right.amount - left.amount)
          .slice(0, 5)
          .map((transaction) => ({
            date: transaction.date,
            amount: transaction.amount,
            label: transaction.notes?.slice(0, 60) ?? transaction.category,
          })),
      });
    }

    return NextResponse.json({
      ok: true,
      userId: audit.userId,
      plaidConnectionsSynced: audit.plaidConnectionsSynced,
      overdueBillCount: audit.overdueBills?.length ?? 0,
      issueCount: audit.issues.length,
      income: {
        displayed: Math.round(calculateMonthlyIncome(financeData, referenceDate) * 100) / 100,
        mode: getIncomeCalculationMode(financeData, referenceDate),
        recurringMonthly: Math.round(calculateRecurringMonthlyIncome(financeData) * 100) / 100,
        currentMonthLedger: Math.round(
          getCurrentMonthLedgerIncomeTotal(financeData, referenceDate) * 100,
        ) / 100,
        averageLedger3Month: Math.round(
          calculateAverageLedgerMonthlyIncome(financeData, referenceDate) * 100,
        ) / 100,
        currentMonthKey: monthKey,
        ledgerMonths,
        diagnostics: incomeDiagnostics?.diagnostics ?? null,
      },
      metrics: audit.metrics.map((metric) => ({
        id: metric.id,
        label: metric.label,
        displayed: metric.displayed,
        formula: metric.formula,
        rawSources: metric.id === "monthly_income" ? metric.rawSources : undefined,
      })),
      overdueBills: audit.overdueBills?.map((bill) => ({
        billId: bill.billId,
        billName: bill.billName,
        amount: bill.amount,
        cycleMonth: bill.cycleMonth,
        unpaidReason: bill.unpaidReason,
      })),
      recomputedAt: audit.recomputedAt,
    });
  } catch (error) {
    console.error("[cron/finance-rebuild] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to rebuild finance data.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
