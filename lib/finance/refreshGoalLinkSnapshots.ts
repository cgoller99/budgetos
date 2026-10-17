/**
 * Persist fresh eligible balances onto linked goals after account sync / edits.
 * Does not change confirmed contribution ledgers or create transactions.
 */
import {
  eligibleAccountBalance,
  type EligibleBalanceAccount,
} from "@/lib/finance/goalAccountLink";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

type SnapshotAccount = EligibleBalanceAccount & { id: string };

export async function refreshGoalLinkSnapshotsForAccounts(
  supabase: BuxmeSupabaseClient,
  userId: string,
  accounts: SnapshotAccount[],
): Promise<number> {
  if (accounts.length === 0) {
    return 0;
  }

  const byId = new Map(accounts.map((account) => [account.id, account]));
  const accountIds = [...byId.keys()];
  const timestamp = new Date().toISOString();

  const { data: goals, error } = await supabase
    .from("goals")
    .select("id, linked_account_id")
    .eq("user_id", userId)
    .in("linked_account_id", accountIds);

  if (error) {
    throw error;
  }

  let updated = 0;
  for (const goal of goals ?? []) {
    const accountId = goal.linked_account_id as string | null;
    if (!accountId) continue;
    const account = byId.get(accountId);
    if (!account) continue;

    const snapshotBalance = eligibleAccountBalance(account);
    const { error: updateError } = await supabase
      .from("goals")
      .update({
        linked_snapshot_balance: snapshotBalance,
        linked_snapshot_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", goal.id)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }
    updated += 1;
  }

  return updated;
}
