export type BillingInterval = "month" | "year";

export function parseBillingInterval(value: string | null | undefined): BillingInterval {
  return value === "year" || value === "yearly" ? "year" : "month";
}
