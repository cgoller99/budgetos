import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  analyzeAiTeamScreenFrame,
  getAiTeamVisionRuntimeInfo,
} from "@/lib/ai-team/screenVision";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_DATA_URL_CHARS = 4_200_000;
const MAX_REQUEST_BYTES = 4_500_000;
const IMAGE_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/;

type VisionRequestBody = {
  frame?: unknown;
  question?: unknown;
};

function invalid(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS },
  );
}
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return invalid("Screen frame is too large.", 413);
  }

  const body = (await request.json().catch(() => null)) as
    | VisionRequestBody
    | null;
  const frame = typeof body?.frame === "string" ? body.frame : "";
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";

  if (
    !frame ||
    frame.length > MAX_DATA_URL_CHARS ||
    question.length > 500
  ) {
    return invalid("Screen analysis request is invalid.");
  }

  const match = IMAGE_DATA_URL.exec(frame);
  if (!match) {
    return invalid("Only JPEG, PNG, or WebP screen frames are accepted.");
  }
  const runtimeInfo = getAiTeamVisionRuntimeInfo();
  if (!runtimeInfo.available) {
    return invalid("Screen intelligence runtime is unavailable.", 503);
  }

  try {
    const analysis = await analyzeAiTeamScreenFrame({
      frameDataUrl: frame,
      mediaType: match[1] as "image/jpeg" | "image/png" | "image/webp",
      question: question || undefined,
      abortSignal: request.signal,
    });

    return NextResponse.json(
      {
        analysis,
        buxmePersisted: false,
        buxmeImageStored: false,
        model: runtimeInfo.model,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (request.signal.aborted) {
      return invalid("Screen analysis was stopped.", 499);
    }
    console.error("[admin/ai-team/vision] Analysis failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return invalid("Unable to analyze the current screen frame.", 502);
  }
}
