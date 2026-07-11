import { NextResponse } from "next/server";
import {
  auditUserFinance,
  refreshUserFinanceAudit,
} from "@/lib/admin/financeAuditService";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;

  try {
    const audit = await auditUserFinance(auth.adminSupabase, userId);

    if (!audit) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ audit });
  } catch (error) {
    console.error("[admin/users/:id/finance-audit] Failed", error);
    return NextResponse.json({ error: "Unable to audit finance data." }, { status: 500 });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;

  try {
    const audit = await refreshUserFinanceAudit(auth.adminSupabase, userId);

    if (!audit) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ audit });
  } catch (error) {
    console.error("[admin/users/:id/finance-audit] Refresh failed", error);
    return NextResponse.json(
      { error: "Unable to refresh finance audit." },
      { status: 500 },
    );
  }
}
