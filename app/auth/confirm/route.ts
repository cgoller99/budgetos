import { type NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/supabase/authCallbackHandler";

/** Handles email links that target /auth/confirm (Supabase default templates). */
export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
