import type { Account, BankConnection, Debt, FinanceData } from "@/lib/finance/types";
import { hasLinkedFinancialAccounts } from "@/lib/transactions/accountLookup";

export type PlaidConnectionUiPhase = "loading" | "empty" | "connected";

export type PlaidConnectionUiState = {
  phase: PlaidConnectionUiPhase;
  /** Active (non-disconnected) institution links. */
  activeConnections: BankConnection[];
  /** Connections that need user attention (Plaid error / login required). */
  reconnectConnections: BankConnection[];
  /** True when at least one healthy linked institution/account exists. */
  hasHealthyLink: boolean;
};

function isReconnectConnection(connection: BankConnection): boolean {
  if (connection.status === "error") {
    return true;
  }

  const code = (connection.errorCode ?? "").toUpperCase();
  const message = (connection.errorMessage ?? "").toLowerCase();

  return (
    code.includes("ITEM_LOGIN_REQUIRED") ||
    code.includes("LOGIN_REQUIRED") ||
    message.includes("reconnect") ||
    message.includes("login required")
  );
}

/**
 * Connection UI state for Accounts / Connect Bank prompts.
 * Uses bankConnections + isPlaidLinked — never transaction presence.
 */
export function getPlaidConnectionUiState(input: {
  isLoading: boolean;
  bankConnections: BankConnection[];
  accounts: Account[];
  debts: Debt[];
}): PlaidConnectionUiState {
  if (input.isLoading) {
    return {
      phase: "loading",
      activeConnections: [],
      reconnectConnections: [],
      hasHealthyLink: false,
    };
  }

  const activeConnections = input.bankConnections.filter(
    (connection) => connection.status !== "disconnected",
  );
  const reconnectConnections = activeConnections.filter(isReconnectConnection);
  const linked = hasLinkedFinancialAccounts({
    bankConnections: input.bankConnections,
    accounts: input.accounts,
    debts: input.debts,
  } as FinanceData);

  const hasHealthyLink =
    activeConnections.some((connection) => connection.status === "connected") ||
    (linked && reconnectConnections.length === 0) ||
    input.accounts.some((account) => account.isPlaidLinked) ||
    input.debts.some((debt) => debt.isPlaidLinked);

  if (hasHealthyLink || activeConnections.length > 0 || linked) {
    return {
      phase: "connected",
      activeConnections,
      reconnectConnections,
      hasHealthyLink: hasHealthyLink || linked,
    };
  }

  return {
    phase: "empty",
    activeConnections,
    reconnectConnections,
    hasHealthyLink: false,
  };
}
