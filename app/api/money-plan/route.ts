import { moneyPlanHttpResponse } from "@/lib/plan/moneyPlanGate.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return moneyPlanHttpResponse([]);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { budgets?: unknown } | null;
  return moneyPlanHttpResponse(body?.budgets);
}
