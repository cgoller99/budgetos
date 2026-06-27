export function MoneyFlowCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-white">
          Money Flow™
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Income vs spending this month
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-white/50">Income</span>
            <span className="font-medium tabular-nums text-white">$6,400</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[85%] rounded-full bg-[#0077ed]" />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-white/50">Spending</span>
            <span className="font-medium tabular-nums text-white">$4,180</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[55%] rounded-full bg-white/30" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
          <span className="text-sm text-white/50">Net flow</span>
          <span className="text-sm font-semibold tabular-nums text-emerald-400">
            +$2,220
          </span>
        </div>
      </div>
    </div>
  );
}
