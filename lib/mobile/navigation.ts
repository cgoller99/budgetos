/** Mobile bottom bar — primary tabs only. */
export const MOBILE_PRIMARY_NAV = [
  { href: "/dashboard", label: "Home", icon: "dashboard" as const },
  { href: "/accounts", label: "Accounts", icon: "accounts" as const },
  { href: "/income", label: "Income", icon: "income" as const },
  { href: "/bills", label: "Bills", icon: "bills" as const },
] as const;

/** Mobile “More” sheet — secondary destinations. */
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

export const MOBILE_MORE_HREFS = MOBILE_MORE_NAV.map((item) =>
  item.href.split("#")[0]!,
);

export function isMobileMoreRoute(activeHref: string): boolean {
  const path = activeHref.split("?")[0] ?? activeHref;
  return MOBILE_MORE_HREFS.some(
    (href) => path === href || path.startsWith(`${href}/`),
  );
}
