"use client";

import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

function AuthFormFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
