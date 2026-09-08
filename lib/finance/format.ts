import type { KPIMetric } from "./types";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toFiniteNumber(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  // Guard against floating-point display artifacts (e.g. 3816.1930000001).
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** User-facing currency: commas + exactly 2 decimal places (e.g. $3,816.19). */
export function formatCurrency(amount: number): string {
  return CURRENCY_FORMATTER.format(toFiniteNumber(amount));
}

export function formatMonthlyChange(amount: number): string {
  const value = toFiniteNumber(amount);
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))} this month`;
}

export function formatSignedCurrency(amount: number): string {
  const value = toFiniteNumber(amount);
  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }
  if (value < 0) {
    return `−${formatCurrency(Math.abs(value))}`;
  }
  return formatCurrency(0);
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
