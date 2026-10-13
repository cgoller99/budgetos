import "server-only";

import { NextResponse } from "next/server";
import {
  moneyPlanApiResult,
  resolveMoneyPlanAccess,
  sanitizeMoneyPlanBudgets,
  type MoneyPlanAccess,
} from "@/lib/plan/moneyPlanAccess";
import { buildMoneyPlan } from "@/lib/plan/moneyPlan";
import { mapProfileToSubscription } from "@/lib/stripe/subscriptionMapper";
import { requireStripeApiUser } from "@/lib/stripe/apiAuth";
import { getEffectiveEntitlements } from "@/lib/subscription/entitlements.server";
import { FinanceService } from "@/lib/supabase/services/financeService";

type MoneyPlanAuth = NonNullable<
  Awaited<ReturnType<typeof requireStripeApiUser>>
>;

function accessForUser(auth: MoneyPlanAuth): MoneyPlanAccess {
  if (!auth.user) {
    return "preview";
  }

  const entitlements = getEffectiveEntitlements({
    email: auth.user.email ?? auth.profile?.email,
    subscription: mapProfileToSubscription(auth.profile),
    adminFounderGranted: auth.profile?.admin_founder_granted,
  });

  return resolveMoneyPlanAccess({
    isFounder: entitlements.isFounder,
    hasProPlusAccess: entitlements.hasProPlusAccess,
  });
}

export async function readMoneyPlanAccess(): Promise<MoneyPlanAccess> {
  try {
    const auth = await requireStripeApiUser();
    if (auth.response || !auth.user) {
      return "preview";
    }
    return accessForUser(auth);
  } catch {
    return "preview";
  }
}

export async function moneyPlanHttpResponse(budgets: unknown): Promise<NextResponse> {
  const auth = await requireStripeApiUser();
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = accessForUser(auth);
  if (access !== "full") {
    const blocked = moneyPlanApiResult({ access, plan: null });
    return NextResponse.json(blocked.body, { status: blocked.status });
  }

  const finance = await new FinanceService(auth.supabase).loadFinanceData(auth.user.id);
  const plan = buildMoneyPlan(
    finance,
    new Date(),
    sanitizeMoneyPlanBudgets(budgets),
  );
  const allowed = moneyPlanApiResult({ access, plan });
  return NextResponse.json(allowed.body, { status: allowed.status });
}
