"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, FormField, Input, PasswordInput } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export function ResetPasswordForm() {
  const router = useRouter();
  const { updatePassword, isConfigured, isLoading, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputId = useId();
  const confirmPasswordInputId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      showToast({
        title: "Password updated",
        subtitle: "You can now sign in with your new password",
      });
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthShell
        title="New password"
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthShell
        title="Reset link expired"
        subtitle="Request a new password reset link to continue."
        footer={
          <>
            <Link href="/forgot-password" className="text-[var(--accent)] hover:underline">
              Request reset link
            </Link>
          </>
        }
      >
        <Button fullWidth onClick={() => router.push("/forgot-password")}>
          Go to forgot password
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="New password"
      subtitle="Choose a new password for your account"
      footer={
        <>
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="New password" htmlFor={passwordInputId}>
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

        <FormField label="Confirm password" htmlFor={confirmPasswordInputId}>
          <PasswordInput
            id={confirmPasswordInputId}
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
