import { NextResponse } from "next/server";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import {
  decryptConnectionAccessToken,
  removePlaidItem,
} from "@/lib/plaid/plaidService";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";
import { FinanceService } from "@/lib/supabase/services/financeService";

type DisconnectAccountRequestBody = {
  accountId?: string;
  deleteTransactions?: boolean;
};

export async function POST(request: Request) {
  try {
    const auth = await requirePlaidApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const body = (await request.json()) as DisconnectAccountRequestBody;
    const accountId = body.accountId?.trim();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required." },
        { status: 400 },
      );
    }

    const financeService = new FinanceService(auth.supabase);
    const data = await financeService.loadFinanceData(auth.user.id);
    const account = data.accounts.find((item) => item.id === accountId);

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (!account.isPlaidLinked || !account.bankConnectionId) {
      return NextResponse.json(
        { error: "Account is not linked to Plaid." },
        { status: 400 },
      );
    }

    const repository = new BankConnectionsRepository(auth.supabase);
    const connection = await repository.getConnectionById(
      auth.user.id,
      account.bankConnectionId,
    );

    if (!connection) {
      return NextResponse.json(
        { error: "Bank connection not found." },
        { status: 404 },
      );
    }

    try {
      const accessToken = decryptConnectionAccessToken(connection);
      await removePlaidItem(accessToken);
    } catch {
      // Continue local disconnect even if Plaid item removal fails.
    }

    const removedAccountIds = await repository.removeConnectionAccounts(
      account.bankConnectionId,
      auth.user.id,
    );

    if (body.deleteTransactions) {
      for (const removedAccountId of removedAccountIds) {
        await auth.supabase
          .from("transactions")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("account_id", removedAccountId);

        await auth.supabase
          .from("transactions")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("transfer_to_account_id", removedAccountId);
      }
    }

    return NextResponse.json({
      ok: true,
      connectionId: account.bankConnectionId,
      removedAccountIds,
    });
  } catch (error) {
    console.error("[accounts/disconnect-plaid] Failed to disconnect account", error);
    return plaidErrorResponse(error, "Unable to disconnect bank account.");
  }
}
