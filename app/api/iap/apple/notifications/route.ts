import { NextResponse } from "next/server";
import { getAppleIapConfig } from "@/lib/iap/config";
import { handleAppleServerNotificationV2 } from "@/lib/iap/appleNotificationHandler";

type NotificationBody = {
  signedPayload?: string;
};

/**
 * App Store Server Notifications V2 endpoint.
 * URL for App Store Connect: https://buxme.co/api/iap/apple/notifications
 */
export async function POST(request: Request) {
  try {
    const appleConfig = getAppleIapConfig();
    if (!appleConfig.isConfigured) {
      console.error("[iap/apple/notifications] Apple IAP credentials missing");
      return NextResponse.json(
        { error: "Apple IAP not configured." },
        { status: 503 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let signedPayload: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as NotificationBody;
      signedPayload = body.signedPayload?.trim();
    } else {
      const text = (await request.text()).trim();
      if (text.startsWith("{")) {
        const body = JSON.parse(text) as NotificationBody;
        signedPayload = body.signedPayload?.trim();
      } else {
        signedPayload = text || undefined;
      }
    }

    if (!signedPayload) {
      return NextResponse.json(
        { error: "signedPayload is required." },
        { status: 400 },
      );
    }

    const result = await handleAppleServerNotificationV2(signedPayload);

    // Always 200 after successful cryptographic verification so Apple does not retry forever
    // for unmatched profiles / ignored notification types.
    return NextResponse.json(result);
  } catch (error) {
    console.error("[iap/apple/notifications] failed", error);
    return NextResponse.json(
      { error: "Unable to process App Store notification." },
      { status: 500 },
    );
  }
}
