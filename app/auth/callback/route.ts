import { type NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/supabase/authCallbackHandler";

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
