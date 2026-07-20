"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

function LoginFormFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
