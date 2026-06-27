export function SmartInsights() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-white">
          Smart Insights
        </h2>
        <p className="mt-1 text-sm text-white/40">Personalized for you</p>
      </div>

      <ul className="space-y-4">
        <li className="flex gap-3 rounded-xl bg-white/[0.03] p-3.5">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#0077ed]" />
          <p className="text-sm leading-relaxed text-white/70">
            You&apos;re on pace to save{" "}
            <span className="font-medium text-white">$20,000</span> this year if
            current habits continue.
          </p>
        </li>
        <li className="flex gap-3 rounded-xl bg-white/[0.03] p-3.5">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <p className="text-sm leading-relaxed text-white/70">
            Dining spend is 18% below your 3-month average — great progress.
          </p>
        </li>
        <li className="flex gap-3 rounded-xl bg-white/[0.03] p-3.5">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          <p className="text-sm leading-relaxed text-white/70">
            Your car insurance renews in 12 days. Review quotes to optimize.
          </p>
        </li>
      </ul>
    </div>
  );
}
