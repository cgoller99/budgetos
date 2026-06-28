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
  ProfileRow,
} from "@/lib/supabase/database.types";
import { backfillHouseholdFinanceRows } from "@/lib/supabase/householdFinance";

function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  };
}

function mapMember(
  row: HouseholdMemberRow,
  profile?: Pick<ProfileRow, "email"> | null,
): HouseholdMember {
  return {
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role as HouseholdRole,
    joinedAt: row.joined_at,
    email: profile?.email ?? null,
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
    token: row.token,
  };
}

export type HouseholdSnapshot = {
  household: Household | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  role: HouseholdRole | null;
  incomingInvites: HouseholdInvite[];
};

export class HouseholdService {
  constructor(private readonly supabase: BudgetOsSupabaseClient) {}

  private async resolveHouseholdId(userId: string): Promise<string | null> {
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (profile?.household_id) {
      return profile.household_id;
    }

    const { data: membership, error: membershipError } = await this.supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    return membership?.household_id ?? null;
  }

  private async loadIncomingInvites(userId: string): Promise<HouseholdInvite[]> {
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const email = profile?.email?.trim().toLowerCase();

    if (!email) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("household_invites")
      .select("*")
      .eq("status", "pending")
      .ilike("email", email);

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapInvite);
  }

  private async loadMembersWithProfiles(
    householdId: string,
  ): Promise<HouseholdMember[]> {
    const { data: members, error: membersError } = await this.supabase
      .from("household_members")
      .select("*")
      .eq("household_id", householdId);

    if (membersError) {
      throw membersError;
    }

    const memberRows = members ?? [];

    if (memberRows.length === 0) {
      return [];
    }

    const userIds = memberRows.map((member) => member.user_id);
    const { data: profiles, error: profilesError } = await this.supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (profilesError) {
      throw profilesError;
    }

    const profileById = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile]),
    );

    return memberRows.map((member) =>
      mapMember(member, profileById.get(member.user_id)),
    );
  }

  async loadHousehold(userId: string): Promise<HouseholdSnapshot> {
    const incomingInvites = await this.loadIncomingInvites(userId);
    const householdId = await this.resolveHouseholdId(userId);

    if (!householdId) {
      return {
        household: null,
        members: [],
        invites: [],
        role: null,
        incomingInvites,
      };
    }

    const [householdResult, members, invitesResult] = await Promise.all([
      this.supabase
        .from("households")
        .select("*")
        .eq("id", householdId)
        .maybeSingle(),
      this.loadMembersWithProfiles(householdId),
      this.supabase
        .from("household_invites")
        .select("*")
        .eq("household_id", householdId)
        .eq("status", "pending"),
    ]);

    if (householdResult.error) throw householdResult.error;
    if (invitesResult.error) throw invitesResult.error;

    const role =
      members.find((member) => member.userId === userId)?.role ??
      (householdResult.data?.owner_id === userId ? "owner" : null);

    return {
      household: householdResult.data ? mapHousehold(householdResult.data) : null,
      members,
      invites: (invitesResult.data ?? []).map(mapInvite),
      role,
      incomingInvites,
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

    await backfillHouseholdFinanceRows(this.supabase, userId, household.id);

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

  async acceptInvite(userId: string, inviteId: string): Promise<HouseholdSnapshot> {
    const { data, error } = await this.supabase.rpc("accept_household_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Invite acceptance did not return a household id.");
    }

    return this.loadHousehold(userId);
  }

  async leaveHousehold(userId: string): Promise<HouseholdSnapshot> {
    const { error } = await this.supabase.rpc("leave_household");

    if (error) {
      throw error;
    }

    return this.loadHousehold(userId);
  }

  async removeMember(
    userId: string,
    memberUserId: string,
  ): Promise<HouseholdSnapshot> {
    const { error } = await this.supabase.rpc("remove_household_member", {
      p_user_id: memberUserId,
    });

    if (error) {
      throw error;
    }

    return this.loadHousehold(userId);
  }

  async transferOwnership(
    userId: string,
    newOwnerUserId: string,
  ): Promise<HouseholdSnapshot> {
    const { error } = await this.supabase.rpc("transfer_household_ownership", {
      p_new_owner_id: newOwnerUserId,
    });

    if (error) {
      throw error;
    }

    return this.loadHousehold(userId);
  }

  async revokeInvite(
    userId: string,
    inviteId: string,
  ): Promise<HouseholdSnapshot> {
    const { error } = await this.supabase.rpc("revoke_household_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      throw error;
    }

    return this.loadHousehold(userId);
  }
}
