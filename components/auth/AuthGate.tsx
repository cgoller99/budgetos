"use client";

import { useEffect, useState } from "react";
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
  const {
    isConfigured,
    isLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();

  useEffect(() => {
    if (!isConfigured || isLoading || !isAuthenticated || !user) {
      return;
    }

    const activeUser = user;

    async function loadProfileState() {
      try {
        const { data } = await getSupabaseClient()
          .from("profiles")
          .select("is_disabled, beta_status")
          .eq("id", activeUser.id)
          .maybeSingle();
        setIsDisabled(Boolean(data?.is_disabled));

        const status = data?.beta_status;
        if (status === "pending" || status === "rejected" || status === "approved") {
          setBetaAccess(status);
        } else {
          setBetaAccess("approved");
        }
      } catch {
        setIsDisabled(false);
        setBetaAccess("approved");
      }
    }

    void loadProfileState();
  }, [isAuthenticated, isConfigured, isLoading, user]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] px-6">
        <p className="max-w-md text-center text-sm text-white/45">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
        </p>
      </div>
    );
  }

  if (isLoading || betaAccess === "unknown") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
      </div>
    );
  }

  if (!isAuthenticated || needsEmailVerification || isDisabled) {
    if (isDisabled) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] px-6">
          <p className="max-w-md text-center text-sm text-white/55">
            This account has been disabled. Contact support if you believe this is a mistake.
          </p>
        </div>
      );
    }

    return null;
  }

  if (betaAccess === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-white">Beta access pending</p>
          <p className="mt-3 text-sm text-white/55">
            Your account is waiting for beta approval. We&apos;ll email you when you can access Buxme.
          </p>
          <Link href="/beta" className="mt-6 inline-block text-sm text-[#4da3ff] hover:underline">
            View beta status
          </Link>
        </div>
      </div>
    );
  }

  if (betaAccess === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] px-6">
        <p className="max-w-md text-center text-sm text-white/55">
          Beta access was not approved for this account. Contact support if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return children;
}
