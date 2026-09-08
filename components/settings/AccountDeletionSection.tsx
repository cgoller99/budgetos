"use client";

import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useToast } from "@/context/ToastContext";
import { shouldWarnAboutAppleBillingOnDeletion } from "@/lib/account/deleteAccountPolicy";
import { APPLE_MANAGE_SUBSCRIPTIONS_URL } from "@/lib/iap/products";
import { isNativePlatform } from "@/lib/native/platform";
import { fetchEntitlements } from "@/lib/subscription/clientApi";
import {
  hasActiveSubscription,
  type UserSubscription,
} from "@/lib/subscription/types";

function isStripeBilledSubscription(subscription: UserSubscription): boolean {
  return (
    subscription.provider === "stripe" && hasActiveSubscription(subscription)
  );
}

function isAppleBillingWarningNeeded(subscription: UserSubscription): boolean {
  return shouldWarnAboutAppleBillingOnDeletion({
    subscriptionProvider: subscription.provider,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    appleOriginalTransactionId: subscription.appleOriginalTransactionId,
  });
}

async function openAppleManageSubscriptions() {
  if (isNativePlatform()) {
    await Browser.open({ url: APPLE_MANAGE_SUBSCRIPTIONS_URL });
    return;
  }

  window.open(APPLE_MANAGE_SUBSCRIPTIONS_URL, "_blank", "noopener,noreferrer");
}

export function AccountDeletionSection() {
  const { signOut, isConfigured } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverSubscription, setServerSubscription] =
    useState<UserSubscription | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setServerSubscription(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        // Refresh shared context and read a fresh server entitlements snapshot so
        // the Apple billing warning is not based only on stale client state.
        await refreshSubscription({ refresh: true });
        const entitlements = await fetchEntitlements({ refresh: true });
        if (!cancelled) {
          setServerSubscription(entitlements.subscription);
        }
      } catch {
        if (!cancelled) {
          // Fall back to context subscription below.
          setServerSubscription(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, refreshSubscription]);

  const billingSubscription = serverSubscription ?? subscription;
  const isStripeBilled = isStripeBilledSubscription(billingSubscription);
  const isAppleBilled = isAppleBillingWarningNeeded(billingSubscription);

  if (!isConfigured) {
    return (
      <Card padding="lg">
        <CardHeader
          title="Delete Account"
          description="Account deletion is temporarily unavailable."
        />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            Buxme cannot reach account services right now. Try again later or email{" "}
            <a
              className="font-medium text-[var(--accent-light)] hover:underline"
              href="mailto:support@buxme.co"
            >
              support@buxme.co
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") {
      showToast({
        title: "Confirmation required",
        subtitle: "Type DELETE to permanently remove your account.",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to delete account.");
      }

      showToast({
        title: "Account deleted",
        subtitle: "Your Buxme account and data have been removed.",
      });
      await signOut();
      window.location.assign("/");
    } catch (error) {
      showToast({
        title: "Deletion failed",
        subtitle:
          error instanceof Error ? error.message : "Unable to delete account.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Delete Account"
        description="Permanently delete your Buxme account and associated user data. This cannot be undone."
      />
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
          <p>
            Deleting your account permanently removes your Buxme login, finance
            data, bank connections, and profile according to our deletion policy.
          </p>
          {isStripeBilled ? (
            <p>
              Your active web/Stripe Buxme subscription will be canceled
              immediately when deletion completes. Stripe invoices are retained
              for records; your Stripe customer profile is not deleted.
            </p>
          ) : null}
          {isAppleBilled ? (
            <div className="space-y-3 rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-4 text-[var(--foreground)]">
              <p className="text-sm font-semibold">
                App Store subscription is still active
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Deleting your Buxme account does{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  not
                </span>{" "}
                cancel your App Store subscription. Apple billing may continue
                until you cancel it in Apple ID → Subscriptions.
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Please cancel or manage your Apple subscription before deleting
                this account if you do not want to keep being charged.
              </p>
              <Button
                variant="secondary"
                size="md"
                className="w-full sm:w-auto"
                disabled={isDeleting}
                onClick={() => void openAppleManageSubscriptions()}
              >
                Manage Apple Subscription
              </Button>
            </div>
          ) : null}
          <p>
            If you own a household with other members, transfer ownership first.
            Type <span className="font-semibold text-[var(--foreground)]">DELETE</span>{" "}
            to confirm.
          </p>
        </div>
        <Input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          aria-label="Type DELETE to confirm account deletion"
        />
        <Button
          variant="secondary"
          className="border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger-muted)]"
          disabled={isDeleting || confirmText !== "DELETE"}
          onClick={() => void handleDelete()}
        >
          {isDeleting
            ? "Deleting..."
            : isAppleBilled
              ? "Delete Account Now"
              : "Delete Account"}
        </Button>
      </CardContent>
    </Card>
  );
}
