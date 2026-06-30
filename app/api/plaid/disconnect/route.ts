import { NextResponse } from "next/server";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import {
  decryptConnectionAccessToken,
  removePlaidItem,
} from "@/lib/plaid/plaidService";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

type DisconnectRequestBody = {
  connectionId?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await requirePlaidApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const body = (await request.json()) as DisconnectRequestBody;
    const connectionId = body.connectionId?.trim();

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required." },
        { status: 400 },
      );
    }

    const repository = new BankConnectionsRepository(auth.supabase);
    const connection = await repository.getConnectionById(
      auth.user.id,
      connectionId,
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

    await repository.disconnectConnection(connectionId, auth.user.id);

    return NextResponse.json({ ok: true, connectionId });
  } catch (error) {
    console.error("[plaid/disconnect] Failed to disconnect bank", error);
    return plaidErrorResponse(error, "Unable to disconnect bank.");
  }
}
