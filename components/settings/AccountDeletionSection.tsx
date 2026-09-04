"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useToast } from "@/context/ToastContext";
import { APPLE_MANAGE_SUBSCRIPTIONS_URL } from "@/lib/iap/products";

export function AccountDeletionSection() {
  const { signOut, isConfigured } = useAuth();
  const { subscription } = useSubscription();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isStripeBilled =
    subscription.provider === "stripe" &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due");

  const isAppleBilled =
    subscription.provider === "apple" ||
    Boolean(subscription.appleOriginalTransactionId);

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
            <p>
              Deleting your Buxme account does{" "}
              <span className="font-semibold text-[var(--foreground)]">not</span>{" "}
              cancel an App Store subscription. Manage or cancel it in{" "}
              <a
                href={APPLE_MANAGE_SUBSCRIPTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--accent-light)] hover:underline"
              >
                Apple ID → Subscriptions
              </a>
              .
            </p>
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
          {isDeleting ? "Deleting..." : "Delete Account"}
        </Button>
      </CardContent>
    </Card>
  );
}
