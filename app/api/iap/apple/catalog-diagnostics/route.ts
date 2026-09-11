import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_TEXT = 300;

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function safeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 8);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const trigger =
    body?.trigger === "manual" ||
    body?.trigger === "resume" ||
    body?.trigger === "online"
      ? body.trigger
      : "initial";
  const status =
    body?.status === "partial" ||
    body?.status === "empty" ||
    body?.status === "error"
      ? body.status
      : null;
  const attempt =
    typeof body?.attempt === "number" && Number.isInteger(body.attempt)
      ? Math.max(1, Math.min(10, body.attempt))
      : null;
  const probe =
    body?.probe && typeof body.probe === "object" && !Array.isArray(body.probe)
      ? (body.probe as Record<string, unknown>)
      : null;

  if (!status || !attempt || !probe) {
    return NextResponse.json(
      { error: "Invalid StoreKit diagnostic." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const perProduct = Array.isArray(probe.perProduct)
    ? probe.perProduct.slice(0, 4).map((row) => {
        const item =
          row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        return {
          productId: safeText(item.productId),
          found: item.found === true,
          priceString: safeText(item.priceString),
          error: safeText(item.error),
        };
      })
    : [];

  console.warn("[iap/storekit-catalog] Native catalog unavailable", {
    authenticated: true,
    trigger,
    status,
    attempt,
    online: typeof body?.online === "boolean" ? body.online : null,
    probedAt: safeText(probe.probedAt),
    platform: safeText(probe.platform),
    appId: safeText(probe.appId),
    appVersion: safeText(probe.appVersion),
    appBuild: safeText(probe.appBuild),
    pluginVersion: safeText(probe.pluginVersion),
    billingSupported:
      typeof probe.billingSupported === "boolean" ? probe.billingSupported : null,
    storeKitBundleId: safeText(probe.storeKitBundleId),
    storeKitEnvironment: safeText(probe.storeKitEnvironment),
    storeKitAppVersion: safeText(probe.storeKitAppVersion),
    storefrontCountryCode: safeText(probe.storefrontCountryCode),
    storefrontId: safeText(probe.storefrontId),
    storefrontError: safeText(probe.storefrontError),
    requestedProductIds: safeStrings(probe.requestedProductIds),
    returnedProductIds: safeStrings(probe.returnedProductIds),
    missingProductIds: safeStrings(probe.missingProductIds),
    returnedCount:
      typeof probe.returnedCount === "number" ? probe.returnedCount : null,
    getProductsError: safeText(probe.getProductsError),
    appInfoError: safeText(probe.appInfoError),
    appTransactionError: safeText(probe.appTransactionError),
    verdict: safeText(probe.verdict),
    perProduct,
  });

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
