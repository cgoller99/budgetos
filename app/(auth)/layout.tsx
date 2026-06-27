"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ENTRY_AUTH_PATHS = new Set(["/login", "/register"]);

function AuthLayoutFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
    </div>
  );
}

function AuthLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isConfigured, isLoading, isAuthenticated, needsEmailVerification, user } =
    useAuth();

  useEffect(() => {
    if (!isConfigured || isLoading || !isAuthenticated) {
      return;
    }

    if (needsEmailVerification) {
      if (pathname === "/verify-email") {
        return;
      }

      const email = user?.email
        ? `?email=${encodeURIComponent(user.email)}`
        : "";
      router.replace(`/verify-email${email}`);
      return;
    }

    if (!pathname || !ENTRY_AUTH_PATHS.has(pathname)) {
      return;
    }

    const redirect = searchParams.get("redirect");

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("/login")) {
      router.replace(redirect);
      return;
    }

    router.replace("/dashboard");
  }, [
    isAuthenticated,
    isConfigured,
    isLoading,
    needsEmailVerification,
    pathname,
    router,
    searchParams,
    user?.email,
  ]);

  const shouldBlock =
    isConfigured &&
    (isLoading ||
      (isAuthenticated &&
        needsEmailVerification &&
        pathname !== "/verify-email") ||
      (isAuthenticated &&
        !needsEmailVerification &&
        pathname &&
        ENTRY_AUTH_PATHS.has(pathname)));

  if (shouldBlock) {
    return <AuthLayoutFallback />;
  }

  return children;
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<AuthLayoutFallback />}>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}
