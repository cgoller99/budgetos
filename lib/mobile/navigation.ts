/** Web mobile bottom bar — primary tabs only. */
export const MOBILE_PRIMARY_NAV = [
  { href: "/dashboard", label: "Home", icon: "dashboard" as const },
  { href: "/accounts", label: "Accounts", icon: "accounts" as const },
  { href: "/income", label: "Income", icon: "income" as const },
  { href: "/bills", label: "Bills", icon: "bills" as const },
] as const;

/** iOS Capacitor primary tabs — app-first IA (web unchanged). */
export const IOS_PRIMARY_NAV = [
  { href: "/dashboard", label: "Home", icon: "home" as const },
  { href: "/accounts", label: "Accounts", icon: "accounts" as const },
  { href: "/bills", label: "Bills", icon: "bills" as const },
  { href: "/debt", label: "Debt", icon: "debt" as const },
] as const;

/** Web mobile “More” sheet — secondary destinations. */
export const MOBILE_MORE_NAV = [
  { href: "/savings", label: "Goals", icon: "savings" as const },
  { href: "/calendar", label: "Calendar", icon: "calendar" as const },
  { href: "/transactions", label: "Transactions", icon: "transactions" as const },
  { href: "/debt", label: "Debt", icon: "debt" as const },
  { href: "/investments", label: "Investments", icon: "reports" as const },
  { href: "/reports", label: "Reports", icon: "reports" as const },
  { href: "/roadmap", label: "Roadmap", icon: "roadmap" as const },
  { href: "/whats-new", label: "What's New", icon: "reports" as const },
  { href: "/settings#household", label: "Household", icon: "settings" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
  { href: "/support", label: "Support", icon: "settings" as const, action: "feedback" as const },
] as const;

/** iOS More menu — secondary destinations (Debt is a primary tab). */
export const IOS_MORE_NAV = [
  { href: "/income", label: "Income", icon: "income" as const, group: "money" as const },
  { href: "/savings", label: "Goals", icon: "savings" as const, group: "money" as const },
  { href: "/investments", label: "Investments", icon: "reports" as const, group: "money" as const },
  {
    href: "/transactions",
    label: "Transactions",
    icon: "transactions" as const,
    group: "money" as const,
  },
  { href: "/reports", label: "Reports", icon: "reports" as const, group: "insights" as const },
  { href: "/calendar", label: "Calendar", icon: "calendar" as const, group: "insights" as const },
  {
    href: "/settings#household",
    label: "Household",
    icon: "settings" as const,
    group: "insights" as const,
  },
  { href: "/settings", label: "Settings", icon: "settings" as const, group: "app" as const },
  { href: "/whats-new", label: "What's New", icon: "reports" as const, group: "app" as const },
  { href: "/roadmap", label: "Roadmap", icon: "roadmap" as const, group: "app" as const },
  {
    href: "/support",
    label: "Support",
    icon: "settings" as const,
    action: "feedback" as const,
    group: "app" as const,
  },
] as const;

export const IOS_MORE_GROUPS = [
  { id: "money" as const, label: "Money" },
  { id: "insights" as const, label: "Insights" },
  { id: "app" as const, label: "App" },
] as const;

export const MOBILE_MORE_HREFS = MOBILE_MORE_NAV.map((item) =>
  item.href.split("#")[0]!,
);

export const IOS_MORE_HREFS = IOS_MORE_NAV.map((item) => item.href.split("#")[0]!);

export function isMobileMoreRoute(activeHref: string): boolean {
  const path = activeHref.split("?")[0] ?? activeHref;
  return MOBILE_MORE_HREFS.some(
    (href) => path === href || path.startsWith(`${href}/`),
  );
}

export function isIosMoreRoute(activeHref: string): boolean {
  const path = activeHref.split("?")[0] ?? activeHref;
  return IOS_MORE_HREFS.some(
    (href) => path === href || path.startsWith(`${href}/`),
  );
}
