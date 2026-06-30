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
    description: "Everything you need to take control of your finances.",
    features: [
      "Unified dashboard",
      "Accounts & transactions",
      "Bills & income tracking",
      "Savings goals & roadmap",
      "Debt tracking",
      "Basic reports",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE?.trim() || "$7.99",
    periodLabel: "month",
    description: "Collaborate with your household and unlock priority support.",
    features: [
      "Everything in Free",
      "Household collaboration",
      "Shared finances",
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
    description: "Advanced reporting and early access to new Buxme features.",
    features: [
      "Everything in Pro",
      "Advanced reports",
      "Early access to new features",
      "Premium insights",
    ],
    highlighted: false,
  },
];

export const PRO_PLUS_ROUTE_PREFIXES = ["/reports"] as const;

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
