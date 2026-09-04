/**
 * Pure Plaid entitlement helpers (safe for unit tests).
 *
 * Product rule:
 * - New Plaid institution links require Pro / Pro+ / Founder.
 * - Existing connections stay usable (reconnect / sync / disconnect).
 */

export type PlaidLinkMode = "create" | "update";

export function isNewPlaidConnectionAttempt(input: {
  mode: PlaidLinkMode;
  hasExistingItem?: boolean;
}): boolean {
  if (input.mode === "update") {
    return false;
  }

  // create-mode exchange for an already-owned Item is a reconnect/refresh, not a new link.
  if (input.hasExistingItem) {
    return false;
  }

  return true;
}

export function canCreateNewPlaidConnection(input: {
  hasProAccess: boolean;
}): boolean {
  return input.hasProAccess;
}

export const PLAID_PRO_REQUIRED_MESSAGE =
  "Connecting a bank with Plaid requires Buxme Pro or Pro+.";

export const PLAID_PRO_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED" as const;
