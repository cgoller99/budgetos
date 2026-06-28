import type { KPIMetric } from "./types";

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatMonthlyChange(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US")} this month`;
}

export function getKPIDisplay(metric: KPIMetric) {
  return {
    label: metric.label,
    value: formatCurrency(metric.value),
    change: formatMonthlyChange(metric.monthlyChange),
    positive: metric.positiveChange ?? true,
  };
}

export const insightToneClasses = {
  blue: "bg-[#0077ed]",
  emerald: "bg-[#4da3ff]",
  amber: "bg-[#2563eb]",
} as const;

export const healthScoreToneClasses = {
  emerald: "text-[#4da3ff]",
  amber: "text-[#60a5fa]",
} as const;

export const planPriorityClasses = {
  critical: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.45)]",
  attention: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]",
  positive: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]",
} as const;
