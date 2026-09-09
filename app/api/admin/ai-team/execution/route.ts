import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { logAdminEvent } from "@/lib/admin/eventLog";
import {
  listAiTeamExecutionCandidates,
  listAiTeamExecutionPackets,
  stageAiTeamExecutionPacket,
} from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BRANCH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const [packets, candidates] = await Promise.all([
      listAiTeamExecutionPackets(auth.adminSupabase, auth.user.id),
      listAiTeamExecutionCandidates(auth.adminSupabase, auth.user.id),
    ]);

    return NextResponse.json({
      packets,
      candidates,
      executed: false,
      notice: "No action executed by Mission Control.",
    });
  } catch (error) {
    console.error("[admin/ai-team/execution] Load failed", error);
    return NextResponse.json(
      { error: "Execution packet persistence is not ready." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        taskId?: unknown;
        proposedBranchName?: unknown;
        implementationBrief?: unknown;
        validationChecklist?: unknown;
        rollbackNotes?: unknown;
      }
    | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const proposedBranchName =
    typeof body?.proposedBranchName === "string"
      ? body.proposedBranchName.trim()
      : "";
  const implementationBrief =
    typeof body?.implementationBrief === "string"
      ? body.implementationBrief.trim()
      : "";
  const rollbackNotes =
    typeof body?.rollbackNotes === "string" ? body.rollbackNotes.trim() : "";
  const validationChecklist = Array.isArray(body?.validationChecklist)
    ? body.validationChecklist
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];

  if (
    !UUID_PATTERN.test(taskId) ||
    proposedBranchName.length < 3 ||
    proposedBranchName.length > 120 ||
    !BRANCH_PATTERN.test(proposedBranchName) ||
    implementationBrief.length < 10 ||
    implementationBrief.length > 5000 ||
    validationChecklist.length === 0 ||
    validationChecklist.some((item) => item.length > 500) ||
    rollbackNotes.length < 10 ||
    rollbackNotes.length > 3000
  ) {
    return NextResponse.json(
      { error: "Execution packet content is invalid." },
      { status: 400 },
    );
  }

  try {
    const packet = await stageAiTeamExecutionPacket(auth.adminSupabase, {
      taskId,
      createdBy: auth.user.id,
      proposedBranchName,
      implementationBrief,
      validationChecklist,
      rollbackNotes,
    });
    await logAdminEvent(auth.adminSupabase, {
      eventType: "ai_team",
      message: "AI Team execution packet staged",
      metadata: { packetId: packet.id, taskId, executed: false },
      userId: auth.user.id,
    });
    return NextResponse.json({
      packet,
      executed: false,
      notice: "No action executed by Mission Control.",
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "P0002") {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }
    if (code === "42501") {
      return NextResponse.json(
        { error: "This task does not belong to your admin account." },
        { status: 403 },
      );
    }
    if (code === "23505") {
      return NextResponse.json(
        { error: "This task already has an execution packet." },
        { status: 409 },
      );
    }
    if (code === "23514") {
      return NextResponse.json(
        { error: "An immutable approved decision is required before staging." },
        { status: 409 },
      );
    }
    console.error("[admin/ai-team/execution] Stage failed", error);
    return NextResponse.json(
      { error: "Unable to stage execution packet." },
      { status: 500 },
    );
  }
}
