import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export type EncryptedTokenPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptAccessToken(accessToken: string): EncryptedTokenPayload {
  assertPlaidConfigured();
  const { tokenEncryptionKey } = getPlaidConfig();

  if (!tokenEncryptionKey) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(tokenEncryptionKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(accessToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptAccessToken(payload: EncryptedTokenPayload): string {
  assertPlaidConfigured();
  const { tokenEncryptionKey } = getPlaidConfig();

  if (!tokenEncryptionKey) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(tokenEncryptionKey),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
