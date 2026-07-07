import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { PLAID_WEBHOOK_MAX_AGE } from "@/lib/plaid/constants";
import { getPlaidClient } from "@/lib/plaid/plaidClient";
import { isPlaidWebhookVerificationRequired } from "@/lib/plaid/config";

const verificationKeyCache = new Map<string, JWK>();

async function getVerificationKey(keyId: string): Promise<JWK | null> {
  const cached = verificationKeyCache.get(keyId);
  if (cached) {
    return cached;
  }

  try {
    const client = getPlaidClient();
    const response = await client.webhookVerificationKeyGet({ key_id: keyId });
    const key = response.data.key as JWK;
    verificationKeyCache.set(keyId, key);
    return key;
  } catch (error) {
    console.error("[plaid/webhook] Failed to fetch verification key", error);
    return null;
  }
}

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function compareBodyHash(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function verifyPlaidWebhook(
  body: string,
  verificationHeader: string | null,
): Promise<{ verified: boolean; reason?: string }> {
  if (!isPlaidWebhookVerificationRequired()) {
    if (!verificationHeader) {
      return { verified: true, reason: "verification_skipped_non_production" };
    }
  }

  if (!verificationHeader) {
    return { verified: false, reason: "missing_plaid_verification_header" };
  }

  let header: ReturnType<typeof decodeProtectedHeader>;

  try {
    header = decodeProtectedHeader(verificationHeader);
  } catch {
    return { verified: false, reason: "invalid_jwt_header" };
  }

  if (header.alg !== "ES256") {
    return { verified: false, reason: "unsupported_jwt_algorithm" };
  }

  if (!header.kid || typeof header.kid !== "string") {
    return { verified: false, reason: "missing_jwt_key_id" };
  }

  const verificationKey = await getVerificationKey(header.kid);

  if (!verificationKey) {
    return { verified: false, reason: "verification_key_unavailable" };
  }

  try {
    const keyLike = await importJWK(verificationKey);
    const { payload } = await jwtVerify(verificationHeader, keyLike, {
      maxTokenAge: PLAID_WEBHOOK_MAX_AGE,
    });

    const requestBodySha256 = payload.request_body_sha256;

    if (typeof requestBodySha256 !== "string") {
      return { verified: false, reason: "missing_request_body_sha256_claim" };
    }

    const bodyHash = hashBody(body);

    if (!compareBodyHash(requestBodySha256, bodyHash)) {
      return { verified: false, reason: "body_hash_mismatch" };
    }

    return { verified: true };
  } catch (error) {
    console.error("[plaid/webhook] JWT verification failed", error);
    return { verified: false, reason: "jwt_verification_failed" };
  }
}

export function resetPlaidWebhookVerificationKeyCache(): void {
  verificationKeyCache.clear();
}
