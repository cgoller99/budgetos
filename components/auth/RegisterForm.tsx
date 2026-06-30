"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLegalLinks } from "@/components/legal/AuthLegalLinks";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, FormField, Input, PasswordInput } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getSafeRedirectPath } from "@/lib/supabase/authUrls";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, isConfigured } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputId = useId();
  const redirect = getSafeRedirectPath(searchParams.get("redirect"), "/onboarding");
  const loginHref = `/login?redirect=${encodeURIComponent(redirect)}`;

  useEffect(() => {
    const prefillEmail = searchParams.get("email")?.trim();

    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signUp(email, password, fullName, redirect);

      if (result.needsEmailVerification) {
        showToast({
          title: "Check your email",
          subtitle: "Confirm your address to finish creating your account",
        });
        router.push(
          `/verify-email?email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirect)}`,
        );
        return;
      }

      showToast({
        title: "Account created",
        subtitle: "Welcome to Buxme",
      });
      router.push(redirect);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthShell
        title="Create account"
        subtitle="Supabase is not configured for this environment."
      >
        <p className="text-center text-sm text-white/45">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local to enable authentication.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Start organizing your financial life"
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="text-[#0077ed] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="Full name">
          <Input
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </FormField>

        <FormField label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </FormField>

        <FormField label="Password" htmlFor={passwordInputId}>
          <PasswordInput
            id={passwordInputId}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </FormField>

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>

        <AuthLegalLinks />
      </form>
    </AuthShell>
  );
}
