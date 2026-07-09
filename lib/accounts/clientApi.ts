"use client";

type DisconnectPlaidAccountInput = {
  accountId: string;
  deleteTransactions?: boolean;
};

export async function disconnectPlaidAccount(
  input: DisconnectPlaidAccountInput,
): Promise<{ removedAccountIds: string[] }> {
  const response = await fetch("/api/accounts/disconnect-plaid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    removedAccountIds?: string[];
  };

  if (!response.ok) {
    throw new Error(body.error ?? `Disconnect failed (HTTP ${response.status})`);
  }

  return {
    removedAccountIds: body.removedAccountIds ?? [],
  };
}
