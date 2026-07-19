"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useToast } from "@/context/ToastContext";
import {
  getLoginUrlForInvite,
  getRegisterUrlForInvite,
} from "@/lib/household/inviteUrls";
import type { HouseholdInvitePreview } from "@/lib/household/invitePreview";

const linkButtonClassName =
  "inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 py-3 text-base font-medium transition-all duration-200 ease-out";

type HouseholdInviteAcceptProps = {
  token: string;
  preview: HouseholdInvitePreview;
};

export function HouseholdInviteAccept({
  token,
  preview,
}: HouseholdInviteAcceptProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { acceptInvite } = useHousehold();
  const { refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedInEmail = user?.email?.trim().toLowerCase() ?? "";
  const inviteEmail = preview.inviteEmail.trim().toLowerCase();
  const emailMatches = signedInEmail === inviteEmail;

  useEffect(() => {
    setError(null);
  }, [signedInEmail, inviteEmail]);

  async function handleAccept() {
    setIsAccepting(true);
    setError(null);

    try {
      await acceptInvite(preview.id);
      await refreshFinance();
      showToast({
        title: "Invite accepted",
        subtitle: `You joined ${preview.householdName}.`,
      });
      router.replace("/settings");
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept invite.",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <AuthShell title="Household invite" subtitle="Loading invite details...">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
        </div>
      </AuthShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthShell
        title="You're invited"
        subtitle={`Join ${preview.householdName} on Buxme`}
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={getLoginUrlForInvite(token)}
              className="text-[var(--accent)] hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-white/55">
            This invite was sent to{" "}
            <span className="font-medium text-white/80">{preview.inviteEmail}</span>.
            Sign in with that email, or create a new account to accept the invite.
          </p>
          <Link
            href={getLoginUrlForInvite(token)}
            className={cn(
              linkButtonClassName,
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
            )}
          >
            Sign in to accept
          </Link>
          <Link
            href={getRegisterUrlForInvite(token, preview.inviteEmail)}
            className={cn(
              linkButtonClassName,
              "border border-white/[0.05] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:text-white",
            )}
          >
            Create account
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!emailMatches) {
    return (
      <AuthShell
        title="Wrong account"
        subtitle={`This invite was sent to ${preview.inviteEmail}`}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-white/55">
            You&apos;re signed in as{" "}
            <span className="font-medium text-white/80">{user?.email}</span>.
            Sign in with {preview.inviteEmail} to accept this household invite.
          </p>
          <Link
            href={getLoginUrlForInvite(token)}
            className={cn(
              linkButtonClassName,
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
            )}
          >
            Switch account
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept household invite"
      subtitle={`Join ${preview.householdName}`}
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-white/55">
          Accepting will share accounts, bills, goals, debts, and dashboard data
          with other members of {preview.householdName}.
        </p>

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Button
          fullWidth
          disabled={isAccepting}
          onClick={() => void handleAccept()}
        >
          {isAccepting ? "Joining..." : "Accept invite"}
        </Button>
        <Link
          href="/dashboard"
          className={cn(
            linkButtonClassName,
            "border border-white/[0.05] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:text-white",
          )}
        >
          Not now
        </Link>
      </div>
    </AuthShell>
  );
}
