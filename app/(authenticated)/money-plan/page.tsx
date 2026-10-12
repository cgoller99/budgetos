import { MoneyPlanScreen } from "@/components/plan/MoneyPlanScreen";
import { readMoneyPlanAccess } from "@/lib/plan/moneyPlanGate.server";

export const dynamic = "force-dynamic";

export default async function MoneyPlanPage() {
  const access = await readMoneyPlanAccess();
  return <MoneyPlanScreen access={access} />;
}
