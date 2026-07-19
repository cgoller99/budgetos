"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseClient } from "@/lib/supabase/client";

type AuthGateProps = {
  children: React.ReactNode;
};

type BetaAccessState = "unknown" | "approved" | "pending" | "rejected";

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDisabled, setIsDisabled] = useState(false);
  const [betaAccess, setBetaAccess] = useState<BetaAccessState>("unknown");
  const [profileError, setProfileError] = useState(false);
  const [profileCheckKey, setProfileCheckKey] = useState(0);
  const {
    isConfigured,
    isLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();

  const retryProfileCheck = useCallback(() => {
    setProfileError(false);
    setBetaAccess("unknown");
    setProfileCheckKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isConfigured || isLoading || !isAuthenticated || !user) {
      return;
    }

    const activeUser = user;

    async function loadProfileState() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("profiles")
          .select("is_disabled, beta_status")
          .eq("id", activeUser.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setProfileError(false);
        setIsDisabled(Boolean(data?.is_disabled));

        const status = data?.beta_status;
        if (status === "pending" || status === "rejected" || status === "approved") {
          setBetaAccess(status);
        } else {
          setBetaAccess("approved");
        }
      } catch {
        setIsDisabled(false);
        setProfileError(true);
        setBetaAccess("unknown");
      }
    }

    void loadProfileState();
  }, [isAuthenticated, isConfigured, isLoading, profileCheckKey, user]);

  useEffect(() => {
    if (!isConfigured || isLoading) {
      return;
    }

    if (!isAuthenticated) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
      return;
    }

    if (needsEmailVerification) {
      const email = user?.email ? `?email=${encodeURIComponent(user.email)}` : "";
      router.replace(`/verify-email${email}`);
    }
  }, [
    isAuthenticated,
    isConfigured,
    isLoading,
    needsEmailVerification,
    pathname,
    router,
    user?.email,
  ]);

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
        <p className="max-w-md text-center text-sm text-[var(--text-muted)]">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
        </p>
      </div>
    );
  }

  if (isLoading || (betaAccess === "unknown" && !profileError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            Could not verify account access
          </p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            We couldn&apos;t load your profile. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={retryProfileCheck}
            className="focus-ring mt-6 rounded-[var(--radius-button)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || needsEmailVerification || isDisabled) {
    if (isDisabled) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
          <p className="max-w-md text-center text-sm text-[var(--text-muted)]">
            This account has been disabled. Contact support if you believe this is a mistake.
          </p>
        </div>
      );
    }

    return null;
  }

  if (betaAccess === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-[var(--foreground)]">Beta access pending</p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Your account is waiting for beta approval. We&apos;ll email you when you can access Buxme.
          </p>
          <Link href="/beta" className="mt-6 inline-block text-sm text-[var(--accent-light)] hover:underline">
            View beta status
          </Link>
        </div>
      </div>
    );
  }

  if (betaAccess === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
        <p className="max-w-md text-center text-sm text-[var(--text-muted)]">
          Beta access was not approved for this account. Contact support if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return children;
}
