import "server-only";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Status } from "@apple/app-store-server-library";
import { assertAppleIapConfigured } from "@/lib/iap/config";
import { loadAppleRootCertificates } from "@/lib/iap/appleRootCertificates";
import { IAP_PRODUCTS } from "@/lib/iap/products";

/** Read-only Apple status check. Never updates entitlements or claims payment proceeds. */
export async function verifyAppleSubscriptionStatus(originalTransactionId: string) {
  if (!/^\d{8,30}$/.test(originalTransactionId)) throw new Error("Invalid Apple transaction identifier");
  const config = assertAppleIapConfigured();
  if (!config.appAppleId) throw new Error("Apple production app ID required");
  const client = new AppStoreServerAPIClient(config.privateKey!, config.keyId!, config.issuerId!, config.bundleId, Environment.PRODUCTION);
  const response = await client.getAllSubscriptionStatuses(originalTransactionId);
  if (response.environment !== Environment.PRODUCTION || response.bundleId !== config.bundleId) throw new Error("Unexpected Apple status environment or bundle");
  const verifier = new SignedDataVerifier(loadAppleRootCertificates(), true, Environment.PRODUCTION, config.bundleId, config.appAppleId);
  for (const group of response.data ?? []) {
    for (const item of group.lastTransactions ?? []) {
      if (item.originalTransactionId !== originalTransactionId || !item.signedTransactionInfo) continue;
      const tx = await verifier.verifyAndDecodeTransaction(item.signedTransactionInfo);
      if (tx.originalTransactionId !== originalTransactionId || tx.revocationDate || !tx.expiresDate || tx.expiresDate <= Date.now()) continue;
      const plan = tx.productId === IAP_PRODUCTS.pro.productId ? "pro" : tx.productId === IAP_PRODUCTS.pro_plus.productId ? "pro_plus" : null;
      if (!plan) continue;
      return { status: item.status, plan, active: item.status === Status.ACTIVE, expiresAt: new Date(tx.expiresDate).toISOString() };
    }
  }
  return { status: null, plan: null, active: false, expiresAt: null };
}
