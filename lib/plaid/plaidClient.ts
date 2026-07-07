import "server-only";

import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type PlaidError,
} from "plaid";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import {
  PLAID_DATA_TRANSPARENCY_DASHBOARD_URL,
  PLAID_DTM_SETUP_INSTRUCTIONS,
} from "@/lib/plaid/constants";

let cachedClient: PlaidApi | null = null;

function resolvePlaidBasePath(environment: ReturnType<typeof getPlaidConfig>["environment"]) {
  switch (environment) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    case "sandbox":
      return PlaidEnvironments.sandbox;
    default:
      return PlaidEnvironments.production;
  }
}

export function getPlaidClient(): PlaidApi {
  if (cachedClient) {
    return cachedClient;
  }

  assertPlaidConfigured();
  const config = getPlaidConfig();

  cachedClient = new PlaidApi(
    new Configuration({
      basePath: resolvePlaidBasePath(config.environment),
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    }),
  );

  return cachedClient;
}

/** Required at Link — checking/savings and transaction accounts. */
export const PLAID_LINK_REQUIRED_PRODUCTS = [Products.Transactions] as const;

/**
 * Consented via DTM but fetched post-Link in syncService (PFM best practice).
 * Do NOT put Liabilities in required products — Link would only show credit/loan accounts.
 */
export const PLAID_LINK_ADDITIONAL_CONSENTED_PRODUCTS = [
  Products.Investments,
  Products.Liabilities,
] as const;

/** @deprecated Use PLAID_LINK_REQUIRED_PRODUCTS + PLAID_LINK_ADDITIONAL_CONSENTED_PRODUCTS */
export const PLAID_LINK_PRODUCTS = [
  ...PLAID_LINK_REQUIRED_PRODUCTS,
  ...PLAID_LINK_ADDITIONAL_CONSENTED_PRODUCTS,
] as const;

export const PLAID_COUNTRY_CODES = [CountryCode.Us] as const;

export function isPlaidItemLoginRequired(error: unknown): boolean {
  const plaidError = error as PlaidError | undefined;
  return plaidError?.error_code === "ITEM_LOGIN_REQUIRED";
}

export function getPlaidErrorMessage(error: unknown): string {
  const plaidError = error as PlaidError | undefined;
  const baseMessage =
    plaidError?.display_message ||
    plaidError?.error_message ||
    (error instanceof Error ? error.message : null) ||
    "Unexpected Plaid error.";

  if (
    plaidError?.error_code === "INVALID_LINK_CUSTOMIZATION" ||
    /data transparency messaging use case/i.test(baseMessage)
  ) {
    return `${baseMessage} ${PLAID_DTM_SETUP_INSTRUCTIONS} ${PLAID_DATA_TRANSPARENCY_DASHBOARD_URL}`;
  }

  return baseMessage;
}
