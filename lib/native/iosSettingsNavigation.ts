/**
 * Pure iOS Settings panel routing helpers (safe for unit tests).
 */

export type IosSettingsPanel =
  | "profile"
  | "billing"
  | "connections"
  | "household"
  | "notifications"
  | "theme"
  | "security"
  | "delete-account"
  | null;

export type IosSettingsRowId =
  | "profile"
  | "billing"
  | "connections"
  | "household"
  | "delete-account"
  | "notifications"
  | "theme"
  | "security"
  | "whats-new"
  | "roadmap"
  | "support";

export type IosSettingsRowMapping = {
  id: IosSettingsRowId;
  title: string;
  /** In-app panel opened by the row, if any. */
  panel: Exclude<IosSettingsPanel, null> | null;
  /** Hash written when opening a hash-backed panel. */
  hash: string | null;
  /** External path for link rows. */
  href: string | null;
  /** Non-navigation action. */
  action: "feedback" | null;
};

/** Canonical Settings list mapping for the iOS Settings screen. */
export const IOS_SETTINGS_ROWS: readonly IosSettingsRowMapping[] = [
  {
    id: "profile",
    title: "Profile",
    panel: "profile",
    hash: null,
    href: null,
    action: null,
  },
  {
    id: "billing",
    title: "Subscription",
    panel: "billing",
    hash: "billing",
    href: null,
    action: null,
  },
  {
    id: "connections",
    title: "Bank connections",
    panel: "connections",
    hash: "connections",
    href: null,
    action: null,
  },
  {
    id: "household",
    title: "Household",
    panel: "household",
    hash: "household",
    href: null,
    action: null,
  },
  {
    id: "delete-account",
    title: "Delete Account",
    panel: "delete-account",
    hash: "delete-account",
    href: null,
    action: null,
  },
  {
    id: "notifications",
    title: "Notifications",
    panel: "notifications",
    hash: null,
    href: null,
    action: null,
  },
  {
    id: "theme",
    title: "Theme",
    panel: "theme",
    hash: null,
    href: null,
    action: null,
  },
  {
    id: "security",
    title: "Security",
    panel: "security",
    hash: null,
    href: null,
    action: null,
  },
  {
    id: "whats-new",
    title: "What's New",
    panel: null,
    hash: null,
    href: "/whats-new",
    action: null,
  },
  {
    id: "roadmap",
    title: "Roadmap",
    panel: null,
    hash: null,
    href: "/roadmap",
    action: null,
  },
  {
    id: "support",
    title: "Support",
    panel: null,
    hash: null,
    href: null,
    action: "feedback",
  },
] as const;

export const IOS_SETTINGS_PANEL_TITLES: Record<
  Exclude<IosSettingsPanel, null>,
  string
> = {
  profile: "Profile",
  billing: "Subscription",
  connections: "Bank connections",
  household: "Household",
  notifications: "Notifications",
  theme: "Theme",
  security: "Security",
  "delete-account": "Delete Account",
};

export function panelFromSettingsHash(
  hash: string | null | undefined,
): IosSettingsPanel {
  const value = (hash ?? "").replace(/^#/, "").trim();
  if (value === "billing") return "billing";
  if (value === "connections") return "connections";
  if (value === "household") return "household";
  if (value === "delete-account" || value === "account") return "delete-account";
  return null;
}

export function settingsUrlForPanel(panel: IosSettingsPanel): string {
  if (!panel) {
    return "/settings";
  }

  const row = IOS_SETTINGS_ROWS.find((item) => item.panel === panel);
  if (row?.hash) {
    return `/settings#${row.hash}`;
  }

  return "/settings";
}

export function resolveSettingsRowDestination(rowId: IosSettingsRowId): {
  panel: IosSettingsPanel;
  href: string | null;
  action: "feedback" | null;
} {
  const row = IOS_SETTINGS_ROWS.find((item) => item.id === rowId);
  if (!row) {
    return { panel: null, href: null, action: null };
  }

  return {
    panel: row.panel,
    href: row.href,
    action: row.action,
  };
}
