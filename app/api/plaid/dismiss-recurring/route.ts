import { NextResponse } from "next/server";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

type DismissRequestBody = {
  merchantKey?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await requirePlaidApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const body = (await request.json()) as DismissRequestBody;
    const merchantKey = body.merchantKey?.trim().toLowerCase();

    if (!merchantKey) {
      return NextResponse.json(
        { error: "merchantKey is required." },
        { status: 400 },
      );
    }

    const repository = new BankConnectionsRepository(auth.supabase);
    await repository.dismissRecurringSuggestion({
      userId: auth.user.id,
      householdId: auth.householdId,
      merchantKey,
    });

    return NextResponse.json({ ok: true, merchantKey });
  } catch (error) {
    console.error("[plaid/dismiss-recurring] Failed to persist dismissal", error);
    return plaidErrorResponse(error, "Unable to save dismissal.");
  }
}
