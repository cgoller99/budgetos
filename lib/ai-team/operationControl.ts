import "server-only";

import { createHash } from "node:crypto";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

const STOP_MESSAGE = "AI Team mission stop requested";

function deterministicUuid(namespace: string, value: string): string {
  const hex = createHash("sha256")
    .update(namespace + ":" + value)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join("");
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join("-");
}

function operationStopRequestId(userId: string, operationId: string): string {
  return deterministicUuid(
    "ai-team-operation-stop",
    userId + ":" + operationId,
  );
}

export async function requestAiTeamOperationStop(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<void> {
  const { error } = await adminSupabase.from("admin_event_logs").insert({
    id: operationStopRequestId(userId, operationId),
    event_type: "ai_team",
    message: STOP_MESSAGE,
    metadata: { operationId },
    user_id: userId,
  });

  if (!error || error.code === "23505") return;
  throw error;
}

export async function isAiTeamOperationStopRequested(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<boolean> {
  const { data, error } = await adminSupabase
    .from("admin_event_logs")
    .select("id")
    .eq("id", operationStopRequestId(userId, operationId))
    .eq("event_type", "ai_team")
    .eq("message", STOP_MESSAGE)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
