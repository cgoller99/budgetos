const GOALS = [
  { name: "Emergency Fund", current: 8200, target: 15000 },
  { name: "Vacation", current: 2400, target: 5000 },
  { name: "New Laptop", current: 900, target: 2000 },
] as const;

export function SavingsGoals() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-white">
          Savings Goals
        </h2>
        <p className="mt-1 text-sm text-white/40">Progress toward targets</p>
      </div>

      <div className="space-y-5">
        {GOALS.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);

          return (
            <div key={goal.name}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-white/80">{goal.name}</span>
                <span className="tabular-nums text-white/45">
                  ${goal.current.toLocaleString()} / $
                  {goal.target.toLocaleString()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#0077ed]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
