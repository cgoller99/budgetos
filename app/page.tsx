import { HealthScoreCard } from "@/components/HealthScoreCard";
import { KPICard } from "@/components/KPICard";
import { MoneyFlowCard } from "@/components/MoneyFlowCard";
import { SavingsGoals } from "@/components/SavingsGoals";
import { Sidebar } from "@/components/Sidebar";
import { SmartInsights } from "@/components/SmartInsights";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 bg-[#0a0f1a] font-sans text-white">
      <Sidebar className="hidden lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="flex-1 space-y-6 p-5 lg:space-y-8 lg:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              label="Net Worth"
              value="$124,580"
              change="+$2,340 this month"
            />
            <KPICard
              label="Cash"
              value="$8,200"
              change="+$420 this month"
            />
            <KPICard
              label="Debt"
              value="$18,750"
              change="-$650 this month"
            />
            <KPICard
              label="Investments"
              value="$97,630"
              change="+$1,890 this month"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MoneyFlowCard />
            <HealthScoreCard />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SmartInsights />
            <SavingsGoals />
          </div>
        </main>
      </div>
    </div>
  );
}
