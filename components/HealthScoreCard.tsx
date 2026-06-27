export function HealthScoreCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-white">
          Financial Health Score
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Based on savings, debt, and cash flow
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#0077ed"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="264"
              strokeDashoffset="47"
            />
          </svg>
          <span className="absolute text-2xl font-semibold tabular-nums">82</span>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-8">
            <span className="text-white/45">Savings rate</span>
            <span className="font-medium text-emerald-400">Strong</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <span className="text-white/45">Debt load</span>
            <span className="font-medium text-amber-400">Moderate</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <span className="text-white/45">Emergency fund</span>
            <span className="font-medium text-emerald-400">On track</span>
          </div>
        </div>
      </div>
    </div>
  );
}
