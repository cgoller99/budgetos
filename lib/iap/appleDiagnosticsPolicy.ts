import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

/** Diagnostic output only; this never grants or revokes account access. */
export function summarizeVerifiedAppleStatus(
  transaction: JWSTransactionDecodedPayload,
  status: number | undefined,
  expectedOriginalId: string,
) {
  if (transaction.bundleId !== "co.buxme.app" || transaction.environment !== "Production" || transaction.originalTransactionId !== expectedOriginalId) {
    throw new Error("Apple subscription identity mismatch.");
  }
  const labels: Record<number, string> = { 1: "active", 2: "expired", 3: "billing_retry", 4: "grace_period", 5: "revoked" };
  const expiry = transaction.expiresDate;
  return {
    appleStatus: status == null ? "unknown" : labels[status] ?? "unknown",
    productId: transaction.productId ?? null,
    expiresAt: typeof expiry === "number" && Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    revoked: transaction.revocationDate != null,
  };
}
