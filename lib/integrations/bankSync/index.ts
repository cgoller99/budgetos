import type { BankConnection, BankConnectionStatus } from "@/lib/finance/types";

export type BankSyncProvider = "plaid" | "manual";

export type BankSyncConnection = BankConnection;

export type BankSyncProviderAdapter = {
  provider: BankSyncProvider;
  connect: () => Promise<{ status: BankConnectionStatus }>;
  disconnect: (connectionId: string) => Promise<void>;
  sync: (connectionId: string) => Promise<void>;
};

export const bankSyncComingSoonMessage =
  "Bank syncing is coming soon. This will automatically import balances and transactions while keeping manual entry available.";

export const manualBankSyncAdapter: BankSyncProviderAdapter = {
  provider: "manual",
  async connect() {
    return { status: "pending" };
  },
  async disconnect() {},
  async sync() {},
};
