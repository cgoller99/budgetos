"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  ensureProfile,
  getAuthErrorMessage,
} from "@/lib/supabase/auth";
import { getAuthCallbackUrl } from "@/lib/supabase/authUrls";
import {
  getSupabaseClient,
  getSupabaseConfig,
} from "@/lib/supabase/client";
import {
  ANALYTICS_EVENTS,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  trackEvent,
} from "@/lib/analytics/client";

export type SignUpResult = {
  needsEmailVerification: boolean;
};

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  needsEmailVerification: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    nextPath?: string,
  ) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendVerificationEmail: (email: string, nextPath?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const { isConfigured } = getSupabaseConfig();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);

  const needsEmailVerification = Boolean(
    user && !user.email_confirmed_at,
  );

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = getSupabaseClient();

    function bootstrapProfile(activeUser: User) {
      void ensureProfile(
        supabase,
        activeUser.id,
        activeUser.email,
        activeUser.user_metadata?.full_name as string | undefined,
      ).catch(() => {
        // DB trigger creates profile on signup; client upsert is a safety net.
      });
    }

    async function loadSession() {
      try {
        const {
          data: { user: validatedUser },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (error || !validatedUser) {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        bootstrapProfile(validatedUser);
        setSession(currentSession);
        setUser(validatedUser);
      } catch {
        setUser(null);
        setSession(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) {
        return;
      }

      if (nextSession?.user) {
        bootstrapProfile(nextSession.user);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName?: string,
      nextPath?: string,
    ) => {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const supabase = getSupabaseClient();
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName?.trim() ?? "",
          },
          emailRedirectTo: getAuthCallbackUrl(nextPath ?? "/onboarding"),
        },
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error));
      }

      if (!data.user) {
        throw new Error("Unable to create account.");
      }

      if (
        !data.session &&
        (!data.user.identities || data.user.identities.length === 0)
      ) {
        throw new Error(
          "An account with this email may already exist. Try signing in, or use Forgot password.",
        );
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        identifyAnalyticsUser({
          id: data.session.user.id,
          email: data.session.user.email,
          name: fullName?.trim() || null,
        });
        trackEvent(
          ANALYTICS_EVENTS.ACCOUNT_CREATED,
          { method: "email" },
          { once: true, dedupeKey: `account-${data.session.user.id}` },
        );
        void ensureProfile(
          supabase,
          data.session.user.id,
          data.session.user.email,
          fullName?.trim(),
        ).catch(() => undefined);
        void fetch("/api/beta/register", { method: "POST" }).catch(() => undefined);
      }

      return {
        needsEmailVerification: Boolean(
          data.user && !data.user.email_confirmed_at && !data.session,
        ),
      };
    },
    [isConfigured],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error));
      }

      if (!data.session || !data.user) {
        throw new Error("Unable to sign in.");
      }

      setSession(data.session);
      setUser(data.user);
      identifyAnalyticsUser({
        id: data.user.id,
        email: data.user.email,
        name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
      });
      trackEvent(
        ANALYTICS_EVENTS.LOGIN,
        { method: "email" },
        { dedupeKey: `login-${data.user.id}-${Math.floor(Date.now() / 600_000)}` },
      );
      void ensureProfile(
        supabase,
        data.user.id,
        data.user.email,
        data.user.user_metadata?.full_name as string | undefined,
      ).catch(() => undefined);
    },
    [isConfigured],
  );

  const signOut = useCallback(async () => {
    if (!isConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }

    setUser(null);
    setSession(null);
    resetAnalyticsUser();
  }, [isConfigured]);

  const resetPassword = useCallback(
    async (email: string) => {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthCallbackUrl("/reset-password"),
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error));
      }
    },
    [isConfigured],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw new Error(getAuthErrorMessage(error));
      }
    },
    [isConfigured],
  );

  const resendVerificationEmail = useCallback(
    async (email: string, nextPath?: string) => {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthCallbackUrl(nextPath ?? "/onboarding"),
        },
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error));
      }
    },
    [isConfigured],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isConfigured,
      isAuthenticated: Boolean(user),
      needsEmailVerification,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      resendVerificationEmail,
    }),
    [
      user,
      session,
      isLoading,
      isConfigured,
      needsEmailVerification,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      resendVerificationEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export { AuthContext };
