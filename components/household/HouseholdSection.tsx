"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  Input,
} from "@/components/ui";
import { useHousehold } from "@/context/HouseholdContext";
import { useToast } from "@/context/ToastContext";

export function HouseholdSection() {
  const {
    household,
    members,
    invites,
    role,
    isLoading,
    isSyncing,
    error,
    createHousehold,
    inviteMember,
  } = useHousehold();
  const { showToast } = useToast();
  const [householdName, setHouseholdName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  async function handleCreateHousehold() {
    try {
      await createHousehold(householdName);
      setHouseholdName("");
      showToast({
        title: "Household created",
        subtitle: "You can now invite a spouse or partner.",
      });
    } catch {
      // Error surfaced in context
    }
  }

  async function handleInviteMember() {
    try {
      await inviteMember(inviteEmail);
      setInviteEmail("");
      showToast({
        title: "Invite sent",
        subtitle: "Your household member will receive an email invite.",
      });
    } catch {
      // Error surfaced in context
    }
  }

  if (isLoading) {
    return (
      <Card padding="lg">
        <CardHeader title="Shared household" />
        <CardContent>
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        </CardContent>
      </Card>
    );
  }

  if (!household) {
    return (
      <Card padding="lg">
        <CardHeader title="Shared household" />
        <CardContent className="space-y-4">
          <p className="text-sm text-white/55">
            Create a household to share accounts, bills, goals, debts, and your
            dashboard with a spouse or partner.
          </p>
          <FormField label="Household name">
            <Input
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              placeholder="The Morgan Household"
            />
          </FormField>
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}
          <Button
            onClick={() => void handleCreateHousehold()}
            disabled={isSyncing || !householdName.trim()}
          >
            {isSyncing ? "Creating..." : "Create household"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Shared household"
        action={
          role ? (
            <Badge variant={role === "owner" ? "accent" : "default"}>
              {role === "owner" ? "Owner" : "Member"}
            </Badge>
          ) : undefined
        }
      />
      <CardContent className="space-y-6">
        <div>
          <p className="text-lg font-semibold text-white">{household.name}</p>
          <p className="mt-1 text-sm text-white/45">
            Both household members can view shared accounts, bills, goals, debts,
            and dashboard data.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-white/70">Members</p>
          {members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Invite someone to join your household."
            />
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={`${member.householdId}-${member.userId}`}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="text-sm text-white/70">
                    {member.email ?? member.userId}
                  </span>
                  <Badge variant={member.role === "owner" ? "accent" : "default"}>
                    {member.role === "owner" ? "Owner" : "Member"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {role === "owner" && (
          <div className="space-y-3">
            <FormField label="Invite by email">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="partner@example.com"
              />
            </FormField>
            <Button
              variant="secondary"
              onClick={() => void handleInviteMember()}
              disabled={isSyncing || !inviteEmail.trim()}
            >
              {isSyncing ? "Sending..." : "Send invite"}
            </Button>
          </div>
        )}

        {invites.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-medium text-white/70">
              Pending invites
            </p>
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="text-sm text-white/70">{invite.email}</span>
                  <Badge variant="warning">Pending</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
