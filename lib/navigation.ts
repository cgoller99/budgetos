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
    subtitle: "Paychecks, your plan, history, and forecasts.",
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
    subtitle: "See bills, income, and contributions by date.",
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
    label: "Debt",
    icon: "debt",
    href: "/debt",
    eyebrow: "Liabilities",
    subtitle: "Plan balances and payoff progress.",
  },
  {
    label: "Investments",
    icon: "reports",
    href: "/investments",
    eyebrow: "Growth",
    subtitle: "Track portfolios and recurring contributions.",
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

/** Secondary routes surfaced in mobile “More” and search. */
/** Secondary routes (not in main sidebar). */
export const NAV_SECONDARY_ROUTES = [
  {
    label: "What's New",
    icon: "reports",
    href: "/whats-new",
    eyebrow: "Product",
    subtitle: "Release notes and product updates.",
  },
] as const;

export const NAV_MORE_ROUTES = [
  {
    label: "Roadmap",
    icon: "roadmap",
    href: "/roadmap",
    eyebrow: "Goals",
    subtitle: "See your next money milestones.",
  },
] as const;

export type NavRoute = (typeof NAV_ROUTES)[number];
export type NavSecondaryRoute = (typeof NAV_SECONDARY_ROUTES)[number];
export type NavMoreRoute = (typeof NAV_MORE_ROUTES)[number];
export type NavItem = NavRoute["label"];

export const NAV_ITEMS: NavItem[] = NAV_ROUTES.map((route) => route.label);

export const ALL_NAV_ROUTES = [
  ...NAV_ROUTES,
  ...NAV_SECONDARY_ROUTES,
  ...NAV_MORE_ROUTES,
] as const;

export function getNavRoute(href: string): NavRoute | NavSecondaryRoute | NavMoreRoute | undefined {
  return ALL_NAV_ROUTES.find((route) => route.href === href);
}

export function getRequiredNavRoute(
  href: (typeof ALL_NAV_ROUTES)[number]["href"],
): NavRoute | NavSecondaryRoute | NavMoreRoute {
  const route = getNavRoute(href);

  if (!route) {
    throw new Error(`Unknown route: ${href}`);
  }

  return route;
}

/** @deprecated Use /income?tab=plan */
export const INCOME_PLAN_HREF = "/income?tab=plan";
