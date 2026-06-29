export const NAV_ROUTES = [
  {
    label: "Dashboard",
    icon: "dashboard",
    href: "/dashboard",
    eyebrow: "Overview",
    subtitle: "Your money at a glance.",
  },
  {
    label: "Accounts",
    icon: "accounts",
    href: "/accounts",
    eyebrow: "Finance",
    subtitle: "Add balances and see what you have.",
  },
  {
    label: "Income",
    icon: "income",
    href: "/income",
    eyebrow: "Cash Flow",
    subtitle: "Track paychecks and other money coming in.",
  },
  {
    label: "Income Plan",
    icon: "income",
    href: "/income/plan",
    eyebrow: "Cash Flow",
    subtitle: "Decide where every paycheck goes.",
  },
  {
    label: "Bills",
    icon: "bills",
    href: "/bills",
    eyebrow: "Cash Flow",
    subtitle: "Keep upcoming payments easy to see.",
  },
  {
    label: "Calendar",
    icon: "calendar",
    href: "/calendar",
    eyebrow: "Cash Flow",
    subtitle: "View bills by date.",
  },
  {
    label: "Transactions",
    icon: "transactions",
    href: "/transactions",
    eyebrow: "Cash Flow",
    subtitle: "Review the activity behind your numbers.",
  },
  {
    label: "Savings",
    icon: "savings",
    href: "/savings",
    eyebrow: "Goals",
    subtitle: "Set goals and watch progress grow.",
  },
  {
    label: "Roadmap",
    icon: "roadmap",
    href: "/roadmap",
    eyebrow: "Goals",
    subtitle: "See your next money milestones.",
  },
  {
    label: "Debt",
    icon: "debt",
    href: "/debt",
    eyebrow: "Liabilities",
    subtitle: "Plan balances and payoff progress.",
  },
  {
    label: "Reports",
    icon: "reports",
    href: "/reports",
    eyebrow: "Analytics",
    subtitle: "Understand trends over time.",
  },
  {
    label: "Settings",
    icon: "settings",
    href: "/settings",
    eyebrow: "System",
    subtitle: "Manage preferences and household access.",
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
