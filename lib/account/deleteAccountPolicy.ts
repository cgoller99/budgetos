/**
 * Pure policy helpers for account deletion (safe to unit-test without server runtime).
 */

export type HouseholdDeletionRole = "none" | "sole_owner" | "owner_with_members" | "member";

export type HouseholdMembershipSnapshot = {
  householdId: string | null;
  ownerId: string | null;
  memberUserIds: string[];
};

export function resolveHouseholdDeletionRole(
  userId: string,
  snapshot: HouseholdMembershipSnapshot,
): HouseholdDeletionRole {
  if (!snapshot.householdId) {
    return "none";
  }

  const members = snapshot.memberUserIds.filter(Boolean);
  const isMember = members.includes(userId);
  const isOwner = snapshot.ownerId === userId;

  if (!isMember && !isOwner) {
    return "none";
  }

  if (isOwner) {
    return members.length > 1 ? "owner_with_members" : "sole_owner";
  }

  return "member";
}

export const HOUSEHOLD_OWNER_BLOCK_MESSAGE =
  "You own a household with other members. Transfer household ownership in Settings → Household before deleting your account.";

export function isStripeSubscriptionActiveForDeletion(input: {
  subscriptionProvider: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  stripeSubscriptionId: string | null | undefined;
}): boolean {
  const status = input.subscriptionStatus ?? "none";
  const activeStatus =
    status === "active" || status === "trialing" || status === "past_due";

  if (!activeStatus) {
    return false;
  }

  if (!input.stripeSubscriptionId) {
    return false;
  }

  const provider = input.subscriptionProvider ?? "none";
  return provider === "stripe" || provider === "none";
}

export function isAppleManagedSubscription(input: {
  subscriptionProvider: string | null | undefined;
  appleOriginalTransactionId: string | null | undefined;
}): boolean {
  return (
    input.subscriptionProvider === "apple" ||
    Boolean(input.appleOriginalTransactionId)
  );
}

/**
 * Whether the deletion UI should warn that App Store billing may continue.
 * Prefers an active Apple entitlement (provider + valid period), and also
 * treats a linked originalTransactionId with an active-like status as Apple-billed.
 */
export function shouldWarnAboutAppleBillingOnDeletion(input: {
  subscriptionProvider: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  appleOriginalTransactionId: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (
    !isAppleManagedSubscription({
      subscriptionProvider: input.subscriptionProvider,
      appleOriginalTransactionId: input.appleOriginalTransactionId,
    })
  ) {
    return false;
  }

  const status = input.subscriptionStatus ?? "none";
  const statusActive =
    status === "active" || status === "trialing" || status === "past_due";

  if (!statusActive) {
    return false;
  }

  const now = input.nowMs ?? Date.now();
  if (input.currentPeriodEnd) {
    const end = Date.parse(input.currentPeriodEnd);
    if (!Number.isNaN(end) && end <= now) {
      return false;
    }
  } else if (input.subscriptionProvider === "apple") {
    // Match Premium fail-closed: Apple without expiry is not treated as active billing.
    return false;
  }

  return true;
}
