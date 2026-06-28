import { notFound } from "next/navigation";
import { HouseholdInviteAccept } from "@/components/household/HouseholdInviteAccept";
import { loadHouseholdInvitePreview } from "@/lib/household/invitePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HouseholdInvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function HouseholdInvitePage({
  params,
}: HouseholdInvitePageProps) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const preview = await loadHouseholdInvitePreview(supabase, token);

  if (!preview) {
    notFound();
  }

  return <HouseholdInviteAccept token={token} preview={preview} />;
}
