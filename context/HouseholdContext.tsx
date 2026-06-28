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
import { useAuth } from "@/context/AuthContext";
import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
} from "@/lib/finance/types";
import {
  getSupabaseClient,
  getSupabaseConfig,
  getErrorMessage,
} from "@/lib/supabase";
import { HouseholdService } from "@/lib/supabase/services/householdService";

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  incomingInvites: HouseholdInvite[];
  role: HouseholdRole | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refreshHousehold: () => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  inviteMember: (
    email: string,
  ) => Promise<{ inviteUrl: string | null; resendId: string | null }>;
  acceptInvite: (inviteId: string) => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<HouseholdInvite[]>([]);
  const [role, setRole] = useState<HouseholdRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(() => {
    if (!isConfigured || !getSupabaseConfig().url) {
      return null;
    }

    return new HouseholdService(getSupabaseClient());
  }, [isConfigured]);

  const applySnapshot = useCallback(
    (snapshot: Awaited<ReturnType<HouseholdService["loadHousehold"]>>) => {
      setHousehold(snapshot.household);
      setMembers(snapshot.members);
      setInvites(snapshot.invites);
      setIncomingInvites(snapshot.incomingInvites);
      setRole(snapshot.role);
    },
    [],
  );

  const refreshHousehold = useCallback(async () => {
    if (!service || !user) {
      setHousehold(null);
      setMembers([]);
      setInvites([]);
      setIncomingInvites([]);
      setRole(null);
      setIsLoading(false);
      return;
    }

    setError(null);

    try {
      const snapshot = await service.loadHousehold(user.id);
      applySnapshot(snapshot);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, service, user]);

  useEffect(() => {
    void refreshHousehold();
  }, [refreshHousehold]);

  const createHousehold = useCallback(
    async (name: string) => {
      if (!service || !user) {
        return;
      }

      setIsSyncing(true);
      setError(null);

      try {
        const snapshot = await service.createHousehold(user.id, name);
        applySnapshot(snapshot);
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [applySnapshot, service, user],
  );

  const inviteMember = useCallback(
    async (email: string) => {
      if (!user) {
        return { inviteUrl: null, resendId: null };
      }

      setIsSyncing(true);
      setError(null);

      try {
        const response = await fetch("/api/household/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const payload = (await response.json()) as {
          error?: string;
          code?: string;
          emailAttempted?: boolean;
          inviteUrl?: string;
          resent?: boolean;
          resendId?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error ??
              (response.status === 503
                ? "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment."
                : "Unable to send household invite."),
          );
        }

        if (service) {
          const snapshot = await service.loadHousehold(user.id);
          applySnapshot(snapshot);
        }

        return {
          inviteUrl: payload.inviteUrl ?? null,
          resendId: payload.resendId ?? null,
        };
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [applySnapshot, service, user],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      if (!service || !user) {
        return;
      }

      setIsSyncing(true);
      setError(null);

      try {
        const snapshot = await service.acceptInvite(user.id, inviteId);
        applySnapshot(snapshot);
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [applySnapshot, service, user],
  );

  const value = useMemo(
    () => ({
      household,
      members,
      invites,
      incomingInvites,
      role,
      isLoading,
      isSyncing,
      error,
      refreshHousehold,
      createHousehold,
      inviteMember,
      acceptInvite,
    }),
    [
      household,
      members,
      invites,
      incomingInvites,
      role,
      isLoading,
      isSyncing,
      error,
      refreshHousehold,
      createHousehold,
      inviteMember,
      acceptInvite,
    ],
  );

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);

  if (!context) {
    throw new Error("useHousehold must be used within HouseholdProvider.");
  }

  return context;
}
