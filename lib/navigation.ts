export const NAV_ROUTES = [
  {
    label: "Dashboard",
    href: "/dashboard",
    eyebrow: "Overview",
    subtitle:
      "Your complete financial snapshot, updated in real time across accounts, cash flow, and goals.",
  },
  {
    label: "Accounts",
    href: "/accounts",
    eyebrow: "Finance",
    subtitle:
      "Connect and manage bank accounts, credit cards, and investment portfolios in one secure view.",
  },
  {
    label: "Income",
    href: "/income",
    eyebrow: "Cash Flow",
    subtitle:
      "Track salary, freelance earnings, dividends, and other income streams with clear monthly trends.",
  },
  {
    label: "Bills",
    href: "/bills",
    eyebrow: "Cash Flow",
    subtitle:
      "Monitor recurring expenses, due dates, and autopay status so nothing catches you off guard.",
  },
  {
    label: "Transactions",
    href: "/transactions",
    eyebrow: "Cash Flow",
    subtitle:
      "Record income, expenses, and transfers — every change flows through to your dashboard instantly.",
  },
  {
    label: "Savings",
    href: "/savings",
    eyebrow: "Goals",
    subtitle:
      "Turn your dreams into a plan. Track milestones and watch your progress grow.",
  },
  {
    label: "Roadmap",
    href: "/roadmap",
    eyebrow: "Goals",
    subtitle:
      "See your full financial timeline — savings goals, debt payoff, investments, and net worth milestones.",
  },
  {
    label: "Debt",
    href: "/debt",
    eyebrow: "Liabilities",
    subtitle:
      "View balances, interest rates, and payoff strategies across loans, cards, and other obligations.",
  },
  {
    label: "Reports",
    href: "/reports",
    eyebrow: "Analytics",
    subtitle:
      "Generate monthly summaries, category breakdowns, and exportable reports for smarter decisions.",
  },
  {
    label: "Settings",
    href: "/settings",
    eyebrow: "System",
    subtitle:
      "Configure preferences, security, notifications, and integrations for your BudgetOS workspace.",
  },
] as const;

export type NavRoute = (typeof NAV_ROUTES)[number];
export type NavItem = NavRoute["label"];

export const NAV_ITEMS: NavItem[] = NAV_ROUTES.map((route) => route.label);

export function getNavRoute(href: string): NavRoute | undefined {
  return NAV_ROUTES.find((route) => route.href === href);
}

export function getRequiredNavRoute(href: NavRoute["href"]): NavRoute {
  const route = getNavRoute(href);

  if (!route) {
    throw new Error(`Unknown route: ${href}`);
  }

  return route;
}
