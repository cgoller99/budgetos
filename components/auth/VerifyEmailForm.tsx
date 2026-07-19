"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getSafeRedirectPath } from "@/lib/supabase/authUrls";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    resendVerificationEmail,
    isConfigured,
    isLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();
  const { onboardingComplete } = useFinance();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email =
    searchParams.get("email")?.trim() ||
    user?.email ||
    "";
  const redirect = getSafeRedirectPath(searchParams.get("redirect"), "/onboarding");
  const loginHref = `/login?redirect=${encodeURIComponent(redirect)}`;

  useEffect(() => {
    if (isAuthenticated && !needsEmailVerification) {
      if (redirect.startsWith("/household/invite/")) {
        router.replace(redirect);
        return;
      }

      router.replace(onboardingComplete ? "/dashboard" : redirect);
    }
  }, [
    isAuthenticated,
    needsEmailVerification,
    onboardingComplete,
    redirect,
    router,
  ]);

  async function handleResend() {
    if (!email) {
      setError("Enter your email on the register page to resend verification.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await resendVerificationEmail(email, redirect);
      showToast({
        title: "Verification email sent",
        subtitle: "Check your inbox to confirm your account",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to resend verification email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthShell
        title="Verify email"
        subtitle="Supabase is not configured for this environment."
        footer={null}
      >
        <p className="text-center text-sm text-white/45">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local to enable authentication.
        </p>
      </AuthShell>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
      </div>
    );
  }

  if (isAuthenticated && !needsEmailVerification) {
    return null;
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Open it to activate your account.`
          : "We sent a confirmation link to your email. Open it to activate your account."
      }
      footer={
        <>
          Already verified?{" "}
          <Link href={loginHref} className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-center text-sm text-white/45">
          {redirect.startsWith("/household/invite/")
            ? "After confirming, you'll return to your household invite."
            : "After confirming, you'll continue into Buxme automatically."}
        </p>

        <p className="text-center text-xs text-white/30">
          No email after a few minutes? Check spam. Supabase&apos;s default email
          service allows about 2 messages per hour — use Resend verification below
          after waiting, or configure custom SMTP in your Supabase dashboard.
        </p>

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Button
          fullWidth
          variant="secondary"
          disabled={isSubmitting || !email}
          onClick={() => void handleResend()}
        >
          {isSubmitting ? "Sending..." : "Resend verification email"}
        </Button>
      </div>
    </AuthShell>
  );
}
