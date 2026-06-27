import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sanitizeAuthNextPath } from "@/lib/supabase/authUrls";
import type { Database } from "@/lib/supabase/database.types";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function redirectToLogin(request: NextRequest, reason = "auth_callback_failed") {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", reason);
  return NextResponse.redirect(loginUrl);
}

function redirectHashAuthToComplete(_request: NextRequest, next: string) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Confirming your account…</title>
  </head>
  <body>
    <p style="font-family:system-ui,sans-serif;text-align:center;margin-top:3rem;color:#666;">
      Confirming your account…
    </p>
    <script>
      window.location.replace("/auth/complete?next=" + encodeURIComponent(${JSON.stringify(next)}) + window.location.hash);
    </script>
  </body>
</html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export async function handleAuthCallback(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    return redirectToLogin(request, "supabase_not_configured");
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeAuthNextPath(requestUrl.searchParams.get("next"));

  const authError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (authError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    if (errorDescription) {
      loginUrl.searchParams.set("message", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!code && !(token_hash && type)) {
    return redirectHashAuthToComplete(request, next);
  }

  let response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.redirect(new URL(next, request.url));

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      return redirectToLogin(request, "auth_callback_failed");
    }

    return response;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectToLogin(request, "auth_callback_failed");
    }

    return response;
  }

  return redirectHashAuthToComplete(request, next);
}
