import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function ensureProfile(
  supabase: BuxmeSupabaseClient,
  userId: string,
  email?: string | null,
  fullName?: string | null,
) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: email ?? null,
      full_name: fullName ?? null,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

export async function getAuthenticatedUserId(
  supabase: BuxmeSupabaseClient,
): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.user) {
    return null;
  }

  await ensureProfile(
    supabase,
    session.user.id,
    session.user.email,
    session.user.user_metadata?.full_name as string | undefined,
  );

  return session.user.id;
}

export async function requireAuthenticatedUser(
  supabase: BuxmeSupabaseClient,
): Promise<string> {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    throw new AuthError("You must be signed in to access this resource.");
  }

  return userId;
}

/** @deprecated Use requireAuthenticatedUser instead. */
export async function ensureAuthenticatedUser(
  supabase: BuxmeSupabaseClient,
): Promise<string> {
  return requireAuthenticatedUser(supabase);
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.message.includes("Invalid login credentials")) {
      return "Invalid email or password.";
    }

    if (error.message.includes("User already registered")) {
      return "An account with this email already exists.";
    }

    if (error.message.includes("Password should be at least")) {
      return "Password must be at least 6 characters.";
    }

    if (error.message.includes("Email not confirmed")) {
      return "Please verify your email before signing in.";
    }

    if (error.message.includes("For security purposes")) {
      return "Please wait a moment before requesting another email.";
    }

    if (error.message.toLowerCase().includes("rate limit")) {
      return "Supabase email limit reached (about 2 emails per hour on the default provider). Wait an hour, or add custom SMTP in Supabase Dashboard → Authentication → SMTP Settings.";
    }

    if (error.message.includes("signup_disabled")) {
      return "New sign-ups are disabled for this project.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}
