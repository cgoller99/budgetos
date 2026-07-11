import { NextResponse } from "next/server";
import { refreshUserFinanceAudit } from "@/lib/admin/financeAuditService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV === "development" && !process.env.VERCEL;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
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

    return NextResponse.json({
      ok: true,
      userId: audit.userId,
      plaidConnectionsSynced: audit.plaidConnectionsSynced,
      overdueBillCount: audit.overdueBills?.length ?? 0,
      issueCount: audit.issues.length,
      metrics: audit.metrics.map((metric) => ({
        id: metric.id,
        label: metric.label,
        displayed: metric.displayed,
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
