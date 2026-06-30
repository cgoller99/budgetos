import type { BankSyncProviderAdapter } from "@/lib/integrations/bankSync";
import {
  disconnectPlaidBank,
  exchangePlaidPublicToken,
  fetchPlaidLinkToken,
  syncPlaidBank,
} from "@/lib/plaid/clientApi";

export const plaidBankSyncAdapter: BankSyncProviderAdapter = {
  provider: "plaid",
  async connect() {
    await fetchPlaidLinkToken({ mode: "create" });
    return { status: "connected" };
  },
  async disconnect(connectionId: string) {
    await disconnectPlaidBank(connectionId);
  },
  async sync(connectionId: string) {
    await syncPlaidBank(connectionId);
  },
};

export async function reconnectPlaidBank(connectionId: string): Promise<string> {
  return fetchPlaidLinkToken({ connectionId, mode: "update" });
}

export { exchangePlaidPublicToken, syncPlaidBank, disconnectPlaidBank };
