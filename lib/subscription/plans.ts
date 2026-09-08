import type { SubscriptionPlan } from "@/lib/subscription/types";

export type PlanDefinition = {
  id: SubscriptionPlan;
  name: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    periodLabel: "forever",
    description: "Manual tracking to take control of your finances.",
    features: [
      "Unified dashboard",
      "Manual accounts & transactions",
      "Bills, income, goals & debt tracking",
      "Basic cash-flow overview",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE?.trim() || "$7.99",
    periodLabel: "month",
    description:
      "Connect banks with Plaid and automate balances, transactions, and cash flow.",
    features: [
      "Everything in Free",
      "Plaid bank, credit, loan & investment sync",
      "Automatic transaction syncing",
      "Connected balances & net worth",
      "Core cash-flow & paycheck automation",
      "Household collaboration",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    priceLabel:
      process.env.NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE?.trim() || "$14.99",
    periodLabel: "month",
    description: "Advanced insights, reporting, and early access tools.",
    features: [
      "Everything in Pro",
      "Advanced reports & premium insights",
      "Early access to new features",
    ],
    highlighted: false,
  },
];

/**
 * Routes that still hard-redirect unpaid users.
 * `/reports` is intentionally NOT gated here — Free/Pro users can open Reports
 * and see in-page upgrade CTAs (avoids Insights → Settings redirects on iOS).
 */
export const PRO_PLUS_ROUTE_PREFIXES = [] as const;

export function getRequiredPlanForPath(pathname: string): SubscriptionPlan | null {
  if (
    PRO_PLUS_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "pro_plus";
  }

  return null;
}
