import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
} from "@/lib/finance/types";
import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";
import type {
  HouseholdInviteRow,
  HouseholdMemberRow,
  HouseholdRow,
} from "@/lib/supabase/database.types";

function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  };
}

function mapMember(row: HouseholdMemberRow): HouseholdMember {
  return {
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role as HouseholdRole,
    joinedAt: row.joined_at,
  };
}

function mapInvite(row: HouseholdInviteRow): HouseholdInvite {
  return {
    id: row.id,
    householdId: row.household_id,
    email: row.email,
    role: row.role as HouseholdRole,
    status: row.status as HouseholdInvite["status"],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export type HouseholdSnapshot = {
  household: Household | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  role: HouseholdRole | null;
};

export class HouseholdService {
  constructor(private readonly supabase: BudgetOsSupabaseClient) {}

  async loadHousehold(userId: string): Promise<HouseholdSnapshot> {
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.household_id) {
      return {
        household: null,
        members: [],
        invites: [],
        role: null,
      };
    }

    const householdId = profile.household_id;

    const [householdResult, membersResult, invitesResult] = await Promise.all([
      this.supabase
        .from("households")
        .select("*")
        .eq("id", householdId)
        .maybeSingle(),
      this.supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId),
      this.supabase
        .from("household_invites")
        .select("*")
        .eq("household_id", householdId)
        .eq("status", "pending"),
    ]);

    if (householdResult.error) throw householdResult.error;
    if (membersResult.error) throw membersResult.error;
    if (invitesResult.error) throw invitesResult.error;

    const members = (membersResult.data ?? []).map(mapMember);
    const role =
      members.find((member) => member.userId === userId)?.role ??
      (householdResult.data?.owner_id === userId ? "owner" : null);

    return {
      household: householdResult.data ? mapHousehold(householdResult.data) : null,
      members,
      invites: (invitesResult.data ?? []).map(mapInvite),
      role,
    };
  }

  async createHousehold(userId: string, name: string): Promise<HouseholdSnapshot> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Household name is required.");
    }

    const { data: household, error: householdError } = await this.supabase
      .from("households")
      .insert({
        name: trimmedName,
        owner_id: userId,
      })
      .select("*")
      .single();

    if (householdError) throw householdError;

    const { error: memberError } = await this.supabase
      .from("household_members")
      .insert({
        household_id: household.id,
        user_id: userId,
        role: "owner",
      });

    if (memberError) throw memberError;

    const { error: profileError } = await this.supabase
      .from("profiles")
      .update({ household_id: household.id })
      .eq("id", userId);

    if (profileError) throw profileError;

    return this.loadHousehold(userId);
  }

  async inviteMember(
    userId: string,
    email: string,
    role: HouseholdRole = "member",
  ): Promise<HouseholdSnapshot> {
    const snapshot = await this.loadHousehold(userId);

    if (!snapshot.household || snapshot.role !== "owner") {
      throw new Error("Only the household owner can send invites.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Invite email is required.");
    }

    const { error } = await this.supabase.from("household_invites").insert({
      household_id: snapshot.household.id,
      email: normalizedEmail,
      role,
      invited_by: userId,
    });

    if (error) throw error;

    return this.loadHousehold(userId);
  }
}
