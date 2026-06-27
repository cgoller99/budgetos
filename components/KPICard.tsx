type KPICardProps = {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
};

export function KPICard({
  label,
  value,
  change,
  positive = true,
}: KPICardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 backdrop-blur-sm sm:p-6">
      <p className="text-sm font-medium text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-3xl">
        {value}
      </p>
      <p
        className={`mt-2 text-xs font-medium tabular-nums ${
          positive ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {change}
      </p>
    </div>
  );
}
