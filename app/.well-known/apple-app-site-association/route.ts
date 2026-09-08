import { NextResponse } from "next/server";
import { APPLE_APP_SITE_ASSOCIATION } from "@/lib/native/appleAppSiteAssociation";

/**
 * Serve AASA with the content-type Apple expects.
 * appID uses Apple Team ID Y7UJK54GL9 + bundle id co.buxme.app.
 */
export async function GET() {
  return NextResponse.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
