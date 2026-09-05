import { NextResponse } from "next/server";
import { getAppleIapHealthReport } from "@/lib/iap/appleApiHealth";

export const runtime = "nodejs";

/**
 * Secret-safe Apple IAP readiness probe.
 * Confirms env presence + whether the App Store Server API accepts our JWT.
 * Does not return key material, PEM contents, or issuer/key ids.
 */
export async function GET() {
  const report = await getAppleIapHealthReport();
  // 200 when env is present (even if Apple auth fails) so the JSON body is readable.
  // Use report.ok / apiAuth to determine whether credentials actually work.
  return NextResponse.json(report, {
    status: report.configured ? 200 : 503,
  });
}
