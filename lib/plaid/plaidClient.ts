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

let cachedClient: PlaidApi | null = null;

function resolvePlaidBasePath(environment: ReturnType<typeof getPlaidConfig>["environment"]) {
  switch (environment) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    default:
      return PlaidEnvironments.sandbox;
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

export const PLAID_LINK_PRODUCTS = [
  Products.Transactions,
  Products.Investments,
  Products.Liabilities,
] as const;

export const PLAID_COUNTRY_CODES = [CountryCode.Us] as const;

export function isPlaidItemLoginRequired(error: unknown): boolean {
  const plaidError = error as PlaidError | undefined;
  return plaidError?.error_code === "ITEM_LOGIN_REQUIRED";
}

export function getPlaidErrorMessage(error: unknown): string {
  const plaidError = error as PlaidError | undefined;

  if (plaidError?.display_message) {
    return plaidError.display_message;
  }

  if (plaidError?.error_message) {
    return plaidError.error_message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Plaid error.";
}
