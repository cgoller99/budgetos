"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useSubscription } from "@/context/SubscriptionContext";
import { useToast } from "@/context/ToastContext";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import {
  getPlanDisplayName,
  getStatusDisplayLabel,
  hasActiveSubscription,
  type PaidSubscriptionPlan,
  type SubscriptionPlan,
} from "@/lib/subscription/types";
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

export function BillingSection() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const stripeEnabled = isStripeClientEnabled();
  const {
    subscription,
    isLoading,
    isFounder,
    refreshSubscription,
    hasProAccess: userHasPro,
    hasProPlusAccess: userHasProPlus,
  } = useSubscription();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [refreshSubscription, searchParams, showToast]);

  async function handleCheckout(plan: PaidSubscriptionPlan) {
    await runAction(`checkout-${plan}`, async () => {
      const url = await startStripeCheckout(plan);
      window.location.assign(url);
    });
  }

  async function handleChangePlan(plan: PaidSubscriptionPlan) {
    await runAction(`change-${plan}`, async () => {
      await changeStripePlan(plan);
      await refreshSubscription({ refresh: true });
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

  if (!stripeEnabled && !isFounder) {
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

  if (!stripeEnabled && isFounder) {
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
        {isFounder && (
          <div className="rounded-2xl border border-[#0077ed]/20 bg-[#0077ed]/10 px-5 py-4">
            <p className="text-sm font-medium text-[#4da3ff]">Founder access</p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              All premium features are unlocked on this account. Stripe checkout is
              optional — use the tools below to test billing flows in Test Mode.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-sm font-medium text-white/45">Current plan</p>
          <p className="mt-1 text-xl font-semibold text-white">
            Buxme {isFounder ? "Pro+" : getPlanDisplayName(currentPlan)}
          </p>
          <p className="mt-2 text-sm text-white/45">
            {isFounder
              ? "Premium access granted via Founder Mode."
              : activePaid
                ? subscription.cancelAtPeriodEnd
                  ? `Access until ${formatRenewalDate(subscription.currentPeriodEnd)}`
                  : `Renews ${formatRenewalDate(subscription.currentPeriodEnd)}`
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
                      ? "border-[#0077ed]/30 bg-[#0077ed]/10"
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
          {!isFounder && activePaid && (
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
          {isFounder && stripeEnabled && (
            <>
              <Button
                variant="secondary"
                size="md"
                disabled={isLoading || pendingAction !== null}
                onClick={() => void handlePortal()}
              >
                {pendingAction === "portal"
                  ? "Opening..."
                  : "Test Stripe portal"}
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
            <Link href="#billing" className="text-[#4da3ff] hover:text-[#0077ed]">
              Buxme Pro
            </Link>
            .
          </p>
        )}

        {!isFounder && !userHasProPlus && (
          <p className="text-xs text-white/35">
            Advanced reports require{" "}
            <Link href="#billing" className="text-[#4da3ff] hover:text-[#0077ed]">
              Buxme Pro+
            </Link>
            .
          </p>
        )}

        {!isFounder && (
          <p className="text-xs text-white/32">
            Secure billing powered by Stripe Checkout and Customer Portal. Test
            mode accepts card 4242 4242 4242 4242.
          </p>
        )}

        {isFounder && stripeEnabled && (
          <p className="text-xs text-white/32">
            Stripe test tools above are optional and do not affect your Founder
            access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
