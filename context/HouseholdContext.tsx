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
  role: HouseholdRole | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refreshHousehold: () => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  inviteMember: (email: string) => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
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

  const refreshHousehold = useCallback(async () => {
    if (!service || !user) {
      setHousehold(null);
      setMembers([]);
      setInvites([]);
      setRole(null);
      setIsLoading(false);
      return;
    }

    setError(null);

    try {
      const snapshot = await service.loadHousehold(user.id);
      setHousehold(snapshot.household);
      setMembers(snapshot.members);
      setInvites(snapshot.invites);
      setRole(snapshot.role);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [service, user]);

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
        setHousehold(snapshot.household);
        setMembers(snapshot.members);
        setInvites(snapshot.invites);
        setRole(snapshot.role);
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [service, user],
  );

  const inviteMember = useCallback(
    async (email: string) => {
      if (!service || !user) {
        return;
      }

      setIsSyncing(true);
      setError(null);

      try {
        const snapshot = await service.inviteMember(user.id, email);
        setHousehold(snapshot.household);
        setMembers(snapshot.members);
        setInvites(snapshot.invites);
        setRole(snapshot.role);
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [service, user],
  );

  const value = useMemo(
    () => ({
      household,
      members,
      invites,
      role,
      isLoading,
      isSyncing,
      error,
      refreshHousehold,
      createHousehold,
      inviteMember,
    }),
    [
      household,
      members,
      invites,
      role,
      isLoading,
      isSyncing,
      error,
      refreshHousehold,
      createHousehold,
      inviteMember,
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
