"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, FormField, Input, PasswordInput } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isConfigured } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputId = useId();

  useEffect(() => {
        if (searchParams.get("error") === "auth_callback_failed") {
      const message = searchParams.get("message");
      setError(
        message ??
          "Your sign-in link expired or is invalid. Please try again or request a new verification email.",
      );
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      showToast({ title: "Welcome back", subtitle: "Signed in successfully" });

      const redirect = searchParams.get("redirect");

      if (redirect && redirect.startsWith("/") && !redirect.startsWith("/login")) {
        router.push(redirect);
        return;
      }

      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthShell
        title="Sign in"
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

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to BudgetOS"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#0077ed] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </FormField>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-[#0077ed] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
