"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isConfigured,
    isLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
      </div>
    );
  }

  if (!isAuthenticated || needsEmailVerification) {
    return null;
  }

  return children;
}
