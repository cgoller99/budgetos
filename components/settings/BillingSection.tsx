"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useToast } from "@/context/ToastContext";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";
import {
  purchaseAndVerifyNativePlan,
  restoreAndVerifyNativePurchases,
} from "@/lib/iap/clientApi";
import { Browser } from "@capacitor/browser";
import {
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
  IAP_PRODUCTS,
  type IapPlan,
} from "@/lib/iap/products";
import { isNativePlatform, shouldUseNativeStoreBilling } from "@/lib/native/platform";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import {
  getPlanDisplayName,
  getStatusDisplayLabel,
  hasActiveSubscription,
  parsePaidPlan,
  type PaidSubscriptionPlan,
  type SubscriptionPlan,
} from "@/lib/subscription/types";
import { type BillingInterval } from "@/lib/stripe/billingInterval";
import {
  cancelStripeSubscription,
  changeStripePlan,
  openStripeBillingPortal,
  reactivateStripeSubscription,
  startStripeCheckout,
} from "@/lib/stripe/clientApi";
import {
  getStripeBillingPeriodLabel,
  getStripeProDisplayPrice,
  getStripeProPlusDisplayPrice,
  isStripeClientEnabled,
} from "@/lib/stripe/clientConfig";

function formatRenewalDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPlanPriceLabel(plan: SubscriptionPlan): string {
  if (plan === "pro") {
    return `${getStripeProDisplayPrice()}/${getStripeBillingPeriodLabel()}`;
  }

  if (plan === "pro_plus") {
    return `${getStripeProPlusDisplayPrice()}/${getStripeBillingPeriodLabel()}`;
  }

  return "$0/forever";
}

async function openAppleManageSubscriptions() {
  if (isNativePlatform()) {
    await Browser.open({ url: APPLE_MANAGE_SUBSCRIPTIONS_URL });
    return;
  }

  window.open(APPLE_MANAGE_SUBSCRIPTIONS_URL, "_blank", "noopener,noreferrer");
}

export function BillingSection() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const stripeEnabled = isStripeClientEnabled();
  const nativeStoreBilling = shouldUseNativeStoreBilling();
  const {
    subscription,
    isLoading,
    isFounder,
    refreshSubscription,
    hasProAccess: userHasPro,
    hasProPlusAccess: userHasProPlus,
    hasMinimumPlan,
  } = useSubscription();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkoutTrackedRef = useRef(false);
  const upgradePlan = parsePaidPlan(searchParams.get("upgrade") ?? undefined);

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPendingAction(key);
      setError(null);

      try {
        await action();
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : "Billing action failed.";
        setError(message);
        showToast({
          title: "Billing action failed",
          subtitle: message,
        });
      } finally {
        setPendingAction(null);
      }
    },
    [showToast],
  );

  useEffect(() => {
    const checkout = searchParams.get("checkout");

    if (checkout === "success") {
      if (!checkoutTrackedRef.current) {
        checkoutTrackedRef.current = true;
        trackEvent(
          ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED,
          { plan: subscription.plan },
          { once: true, dedupeKey: "subscription-purchased" },
        );
        trackEvent(
          ANALYTICS_EVENTS.SUBSCRIPTION_STARTED,
          { plan: subscription.plan },
          { once: true, dedupeKey: "subscription-started" },
        );
      }
      showToast({
        title: "Subscription updated",
        subtitle: "Your Buxme plan is now active.",
      });
      void refreshSubscription({ refresh: true });
    }

    if (checkout === "canceled") {
      showToast({
        title: "Checkout canceled",
        subtitle: "No changes were made to your plan.",
      });
    }
  }, [refreshSubscription, searchParams, showToast, subscription.plan]);

  async function handleCheckout(
    plan: PaidSubscriptionPlan,
    billing: BillingInterval = "month",
  ) {
    await runAction(`checkout-${plan}`, async () => {
      trackEvent(ANALYTICS_EVENTS.STRIPE_CHECKOUT_STARTED, { plan, billing });
      const url = await startStripeCheckout(plan, billing);
      window.location.assign(url);
    });
  }

  async function handleNativePurchase(plan: IapPlan) {
    await runAction(`iap-${plan}`, async () => {
      if (!user?.id) {
        throw new Error("Sign in to purchase a Buxme subscription.");
      }

      if (
        subscription.provider === "stripe" &&
        hasActiveSubscription(subscription)
      ) {
        throw new Error(
          "You already have a web subscription. Manage it on buxme.co or cancel it before buying in the App Store.",
        );
      }

      await purchaseAndVerifyNativePlan(plan, user.id);
      await refreshSubscription({ refresh: true });
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED, {
        plan,
        provider: "apple",
      });
      showToast({
        title: "Subscription updated",
        subtitle: `Buxme ${getPlanDisplayName(plan)} is now active via the App Store.`,
      });
    });
  }

  async function handleRestorePurchases() {
    await runAction("restore", async () => {
      const result = await restoreAndVerifyNativePurchases();
      await refreshSubscription({ refresh: true });

      if (!result.restored) {
        showToast({
          title: "No purchases found",
          subtitle: "We couldn't find an App Store subscription for this Apple ID.",
        });
        return;
      }

      showToast({
        title: "Purchases restored",
        subtitle: result.plan
          ? `Restored Buxme ${getPlanDisplayName(result.plan)}.`
          : "Your App Store subscription was restored.",
      });
    });
  }

  async function handleChangePlan(plan: PaidSubscriptionPlan) {
    await runAction(`change-${plan}`, async () => {
      const currentPlan = subscription.plan;
      await changeStripePlan(plan);
      await refreshSubscription({ refresh: true });

      if (plan === "pro_plus" && currentPlan === "pro") {
        trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_UPGRADED, {
          from: currentPlan,
          to: plan,
        });
      } else if (plan === "pro" && currentPlan === "pro_plus") {
        trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_DOWNGRADED, {
          from: currentPlan,
          to: plan,
        });
      }

      showToast({
        title: "Plan updated",
        subtitle: `You are now on ${getPlanDisplayName(plan)}.`,
      });
    });
  }

  async function handleCancel() {
    await runAction("cancel", async () => {
      await cancelStripeSubscription({ atPeriodEnd: true });
      await refreshSubscription({ refresh: true });
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_CANCELLED, {
        plan: subscription.plan,
      });
      showToast({
        title: "Subscription canceled",
        subtitle: "Your plan stays active until the end of the billing period.",
      });
    });
  }

  async function handleReactivate() {
    await runAction("reactivate", async () => {
      await reactivateStripeSubscription();
      await refreshSubscription({ refresh: true });
      showToast({
        title: "Subscription reactivated",
        subtitle: "Your plan will renew automatically.",
      });
    });
  }

  async function handlePortal() {
    await runAction("portal", async () => {
      const url = await openStripeBillingPortal();
      window.location.assign(url);
    });
  }

  if (!nativeStoreBilling && !stripeEnabled && !isFounder) {
    return (
      <Card padding="lg" id="billing">
        <CardHeader
          title="Plan & billing"
          action={<Badge variant="warning">Setup required</Badge>}
        />
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-white/55">
            Stripe billing is not enabled yet. Add your Stripe keys and price IDs
            to `.env.local`, then set `NEXT_PUBLIC_STRIPE_ENABLED=true`.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!nativeStoreBilling && !stripeEnabled && isFounder) {
    return (
      <Card padding="lg" id="billing">
        <CardHeader
          title="Plan & billing"
          action={<Badge variant="accent">Founder</Badge>}
        />
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-white/55">
            Founder access is active. All premium features are unlocked without a
            Stripe subscription.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activePaid = hasActiveSubscription(subscription);
  const currentPlan = subscription.plan;
  const isAppleBilled = subscription.provider === "apple";
  const isStripeBilled = subscription.provider === "stripe" && activePaid;

  return (
    <Card padding="lg" id="billing">
      <CardHeader
        title="Plan & billing"
        action={
          <div className="flex items-center gap-2">
            {isFounder && <Badge variant="accent">Founder</Badge>}
            <Badge variant={activePaid || isFounder ? "accent" : "default"}>
              {isLoading
                ? "Loading..."
                : isFounder
                  ? "Pro+ access"
                  : getStatusDisplayLabel(subscription)}
            </Badge>
          </div>
        }
      />
      <CardContent className="space-y-5">
        {upgradePlan && !isFounder && !hasMinimumPlan(upgradePlan) ? (
          <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-muted)] px-5 py-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Upgrade to {getPlanDisplayName(upgradePlan)} to unlock this feature
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {nativeStoreBilling
                ? "Choose a plan below. Purchases use Apple In-App Purchase."
                : "Choose a plan below to continue. Checkout opens securely through Stripe."}
            </p>
          </div>
        ) : null}

        {isFounder && (
          <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-5 py-4">
            <p className="text-sm font-medium text-[var(--accent-light)]">
              Founder access
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              All premium features are unlocked on this account.
              {nativeStoreBilling
                ? " App Store purchase tools below are optional for testing."
                : " Stripe checkout is optional — use the tools below to test billing flows in Test Mode."}
            </p>
          </div>
        )}

        {nativeStoreBilling && isStripeBilled && !isFounder ? (
          <div className="rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning-muted)] px-5 py-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Web subscription active
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Your Buxme plan is billed through Stripe on the web. Manage or cancel
              it at{" "}
              <a
                href="https://buxme.co/settings#billing"
                className="text-[var(--accent-light)] underline-offset-2 hover:underline"
              >
                buxme.co/settings
              </a>
              . App Store purchases are blocked while this subscription is active
              to prevent double billing.
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-sm font-medium text-white/45">Current plan</p>
          <p className="mt-1 text-xl font-semibold text-white">
            Buxme {isFounder ? "Pro+" : getPlanDisplayName(currentPlan)}
          </p>
          <p className="mt-2 text-sm text-white/45">
            {isFounder
              ? "Premium access granted via Founder Mode."
              : activePaid
                ? `${
                    isAppleBilled
                      ? "Billed via App Store. "
                      : isStripeBilled
                        ? "Billed via Stripe. "
                        : ""
                  }${
                    subscription.cancelAtPeriodEnd
                      ? `Access until ${formatRenewalDate(subscription.currentPeriodEnd)}`
                      : `Renews ${formatRenewalDate(subscription.currentPeriodEnd)}`
                  }`
                : nativeStoreBilling
                  ? "Choose a paid plan to unlock household collaboration and advanced reports. Purchases use Apple In-App Purchase."
                  : "Choose a paid plan to unlock household collaboration and advanced reports."}
          </p>
        </div>

        {!isFounder && (
          <div className="grid gap-3 lg:grid-cols-3">
            {PLAN_DEFINITIONS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isUpgradeTarget =
                plan.id !== "free" &&
                !isCurrent &&
                (!activePaid ||
                  (plan.id === "pro_plus" && currentPlan === "pro"));

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-2xl border px-4 py-4",
                    isCurrent
                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/10"
                      : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    {isCurrent && <Badge variant="accent">Current</Badge>}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {plan.id === "free"
                      ? plan.priceLabel
                      : nativeStoreBilling
                        ? `${IAP_PRODUCTS[plan.id as IapPlan].label} · App Store`
                        : getPlanPriceLabel(plan.id)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {plan.description}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="text-xs text-white/50">
                        ✓ {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {plan.id === "free" ? (
                      <p className="text-xs text-white/35">
                        Included with every account
                      </p>
                    ) : isCurrent ? (
                      <p className="text-xs text-white/35">Your active paid plan</p>
                    ) : nativeStoreBilling ? (
                      isStripeBilled ? (
                        <p className="text-xs text-white/35">
                          Manage on the web to avoid duplicate billing
                        </p>
                      ) : !activePaid || isAppleBilled ? (
                        <Button
                          size="sm"
                          className="relative z-[1] w-full touch-manipulation"
                          disabled={pendingAction !== null}
                          onClick={() =>
                            void handleNativePurchase(plan.id as IapPlan)
                          }
                        >
                          {pendingAction === `iap-${plan.id}`
                            ? "Purchasing..."
                            : `Subscribe to ${plan.name}`}
                        </Button>
                      ) : null
                    ) : !activePaid ? (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isLoading || pendingAction !== null}
                        onClick={() =>
                          void handleCheckout(plan.id as PaidSubscriptionPlan)
                        }
                      >
                        {pendingAction === `checkout-${plan.id}`
                          ? "Redirecting..."
                          : `Subscribe to ${plan.name}`}
                      </Button>
                    ) : isUpgradeTarget ? (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isLoading || pendingAction !== null}
                        onClick={() =>
                          void handleChangePlan(plan.id as PaidSubscriptionPlan)
                        }
                      >
                        {pendingAction === `change-${plan.id}`
                          ? "Updating..."
                          : plan.id === "pro_plus"
                            ? "Upgrade to Pro+"
                            : "Switch to Pro"}
                      </Button>
                    ) : plan.id === "pro" && currentPlan === "pro_plus" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={isLoading || pendingAction !== null}
                        onClick={() => void handleChangePlan("pro")}
                      >
                        {pendingAction === "change-pro"
                          ? "Updating..."
                          : "Downgrade to Pro"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-amber-300">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {nativeStoreBilling && (
            <>
              <Button
                variant="secondary"
                size="md"
                className="relative z-[1] touch-manipulation"
                disabled={pendingAction !== null}
                onClick={() => void handleRestorePurchases()}
              >
                {pendingAction === "restore" ? "Restoring..." : "Restore Purchases"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="relative z-[1] touch-manipulation"
                disabled={pendingAction !== null}
                onClick={() => void openAppleManageSubscriptions()}
              >
                Manage App Store subscription
              </Button>
            </>
          )}

          {!nativeStoreBilling && !isFounder && activePaid && (
            <>
              <Button
                variant="secondary"
                size="md"
                disabled={isLoading || pendingAction !== null}
                onClick={() => void handlePortal()}
              >
                {pendingAction === "portal"
                  ? "Opening..."
                  : "Payment methods & invoices"}
              </Button>
              {subscription.cancelAtPeriodEnd ? (
                <Button
                  size="md"
                  disabled={isLoading || pendingAction !== null}
                  onClick={() => void handleReactivate()}
                >
                  {pendingAction === "reactivate"
                    ? "Reactivating..."
                    : "Reactivate subscription"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isLoading || pendingAction !== null}
                  onClick={() => void handleCancel()}
                >
                  {pendingAction === "cancel" ? "Canceling..." : "Cancel subscription"}
                </Button>
              )}
            </>
          )}

          {!nativeStoreBilling && isFounder && stripeEnabled && (
            <>
              <Button
                variant="secondary"
                size="md"
                disabled={isLoading || pendingAction !== null}
                onClick={() => void handlePortal()}
              >
                {pendingAction === "portal" ? "Opening..." : "Test Stripe portal"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={isLoading || pendingAction !== null}
                onClick={() => void handleCheckout("pro_plus")}
              >
                {pendingAction === "checkout-pro_plus"
                  ? "Redirecting..."
                  : "Test Stripe checkout"}
              </Button>
            </>
          )}

          <Button
            variant="secondary"
            size="md"
            disabled={isLoading || pendingAction !== null}
            onClick={() => void refreshSubscription({ refresh: true })}
          >
            Refresh
          </Button>
        </div>

        {!isFounder && !userHasPro && (
          <p className="text-xs text-white/35">
            Household collaboration requires{" "}
            <Link
              href="#billing"
              className="text-[var(--accent-light)] hover:text-[var(--accent)]"
            >
              Buxme Pro
            </Link>
            .
          </p>
        )}

        {!isFounder && !userHasProPlus && (
          <p className="text-xs text-white/35">
            Advanced reports require{" "}
            <Link
              href="#billing"
              className="text-[var(--accent-light)] hover:text-[var(--accent)]"
            >
              Buxme Pro+
            </Link>
            .
          </p>
        )}

        {nativeStoreBilling ? (
          <p className="text-xs text-white/32">
            iOS subscriptions use Apple In-App Purchase. Existing Stripe
            subscribers keep access after login. Payment is charged to your Apple
            ID. Manage or cancel in Settings → Apple ID → Subscriptions.
          </p>
        ) : !isFounder ? (
          <p className="text-xs text-white/32">
            Secure billing powered by Stripe Checkout and Customer Portal. Test
            mode accepts card 4242 4242 4242 4242.
          </p>
        ) : null}

        {!nativeStoreBilling && isFounder && stripeEnabled && (
          <p className="text-xs text-white/32">
            Stripe test tools above are optional and do not affect your Founder
            access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
