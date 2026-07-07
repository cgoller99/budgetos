import "server-only";

import type { LinkTokenCreateRequest } from "plaid";
import {
  getPlaidClient,
  getPlaidErrorMessage,
  isPlaidItemLoginRequired,
  PLAID_COUNTRY_CODES,
  PLAID_LINK_PRODUCTS,
} from "@/lib/plaid/plaidClient";
import { getPlaidConfig, resolvePlaidWebhookUrl } from "@/lib/plaid/config";
import { getPlaidOAuthRedirectUri } from "@/lib/plaid/oauth";
import { decryptAccessToken, encryptAccessToken } from "@/lib/plaid/tokenVault";
import type { PlaidLinkMode } from "@/lib/plaid/types";
import type { BankConnectionRow } from "@/lib/supabase/database.types";

export type CreateLinkTokenInput = {
  userId: string;
  mode?: PlaidLinkMode;
  accessToken?: string | null;
};

export type ExchangePublicTokenResult = {
  itemId: string;
  institutionName: string | null;
  institutionId: string | null;
  encryptedToken: ReturnType<typeof encryptAccessToken>;
};

export async function createPlaidLinkToken(
  input: CreateLinkTokenInput,
): Promise<string> {
  const client = getPlaidClient();
  const config = getPlaidConfig();
  const request: LinkTokenCreateRequest = {
    user: { client_user_id: input.userId },
    client_name: "Buxme",
    products: [...PLAID_LINK_PRODUCTS],
    country_codes: [...PLAID_COUNTRY_CODES],
    language: "en",
    webhook: resolvePlaidWebhookUrl(config),
    redirect_uri: getPlaidOAuthRedirectUri(),
  };

  if (input.mode === "update" && input.accessToken) {
    request.access_token = input.accessToken;
  }

  const linkCustomizationName = process.env.PLAID_LINK_CUSTOMIZATION_NAME?.trim();
  if (linkCustomizationName) {
    request.link_customization_name = linkCustomizationName;
  }

  const response = await client.linkTokenCreate(request);
  return response.data.link_token;
}

export async function exchangePlaidPublicToken(
  publicToken: string,
): Promise<ExchangePublicTokenResult> {
  const client = getPlaidClient();
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const itemId = response.data.item_id;
  const accessToken = response.data.access_token;

  let institutionName: string | null = null;
  let institutionId: string | null = null;

  try {
    const itemResponse = await client.itemGet({ access_token: accessToken });
    institutionId = itemResponse.data.item.institution_id ?? null;

    if (institutionId) {
      const institutionResponse = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [...PLAID_COUNTRY_CODES],
      });
      institutionName = institutionResponse.data.institution.name;
    }
  } catch {
    // Institution metadata is optional for the initial connection.
  }

  return {
    itemId,
    institutionName,
    institutionId,
    encryptedToken: encryptAccessToken(accessToken),
  };
}

export function decryptConnectionAccessToken(
  connection: Pick<
    BankConnectionRow,
    "access_token_encrypted" | "access_token_iv" | "access_token_tag"
  >,
): string {
  if (
    !connection.access_token_encrypted ||
    !connection.access_token_iv ||
    !connection.access_token_tag
  ) {
    throw new Error("Bank connection is missing encrypted access token.");
  }

  return decryptAccessToken({
    ciphertext: connection.access_token_encrypted,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });
}

export async function removePlaidItem(accessToken: string): Promise<void> {
  const client = getPlaidClient();

  try {
    await client.itemRemove({ access_token: accessToken });
  } catch (error) {
    if (isPlaidItemLoginRequired(error)) {
      return;
    }

    throw new Error(getPlaidErrorMessage(error));
  }
}

export { getPlaidErrorMessage, isPlaidItemLoginRequired };
