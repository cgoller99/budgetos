"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { sanitizeAuthNextPath } from "@/lib/supabase/authUrls";

function AuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function confirmSession() {
      const next = sanitizeAuthNextPath(searchParams.get("next"));
      const supabase = getSupabaseClient();
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const hashParams = new URLSearchParams(hash);
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (cancelled) {
          return;
        }

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        router.replace(next);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (session?.user) {
        router.replace(next);
        return;
      }

      setError("Your confirmation link expired or is invalid. Request a new one.");
    }

    void confirmSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    router.replace(
      `/login?error=auth_callback_failed&message=${encodeURIComponent(error)}`,
    );
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
        </div>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  );
}
