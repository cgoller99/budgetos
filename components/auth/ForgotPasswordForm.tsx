"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, FormField, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export function ForgotPasswordForm() {
  const { resetPassword, isConfigured } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setSent(true);
      showToast({
        title: "Reset email sent",
        subtitle: "Check your inbox for a password reset link",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send reset email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthShell
        title="Reset password"
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

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We sent a password reset link if an account exists for that address."
        footer={
          <>
            Remember your password?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <Button fullWidth onClick={() => setSent(false)} variant="secondary">
          Send another link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we will send a reset link"
      footer={
        <>
          Remember your password?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Sign in
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

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
