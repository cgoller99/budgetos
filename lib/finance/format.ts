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
  blue: "bg-[var(--accent-muted)] text-[var(--accent-light)]",
  emerald: "bg-[var(--success-muted)] text-[var(--success)]",
  amber: "bg-[var(--warning-muted)] text-[var(--warning)]",
} as const;

export const healthScoreToneClasses = {
  emerald: "text-[var(--success)]",
  amber: "text-[var(--warning)]",
} as const;

export const planPriorityClasses = {
  critical: "bg-[var(--danger)]",
  attention: "bg-[var(--warning)]",
  positive: "bg-[var(--success)]",
} as const;
