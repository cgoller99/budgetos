"use client";

let inFlightRegistration: Promise<void> | null = null;
let registeredUserIds = new Set<string>();

/**
 * Ensures `/api/beta/register` runs once per browser session after email verification.
 */
export function ensureBetaRegistration(userId: string): Promise<void> {
  if (registeredUserIds.has(userId)) {
    return Promise.resolve();
  }

  if (inFlightRegistration) {
    return inFlightRegistration;
  }

  inFlightRegistration = fetch("/api/beta/register", { method: "POST" })
    .then(async (response) => {
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unable to finalize beta registration.");
      }

      registeredUserIds.add(userId);
    })
    .finally(() => {
      inFlightRegistration = null;
    });

  return inFlightRegistration;
}

export function resetBetaRegistrationCacheForTests(): void {
  inFlightRegistration = null;
  registeredUserIds = new Set();
}
