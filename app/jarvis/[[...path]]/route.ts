import { createApp } from "../../../apps/jarvis/lib/app.mjs";
import { dashboardAssets, mountJarvis } from "../../../apps/jarvis/lib/mount.mjs";
import { verifyJarvisAdmin } from "../../../lib/jarvis/buxmeAdmin";

void dashboardAssets.length;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jarvis = createApp({
  dataDir: process.env.JARVIS_DATA_DIR || (process.env.VERCEL === "1" ? "/tmp/jarvis" : undefined),
});

const SHARE_PATH = /^\/jarvis\/share\/([A-Za-z0-9_-]{43})$/;

async function handle(request: Request) {
  const share = new URL(request.url).pathname.match(SHARE_PATH);
  if (share && (request.method === "GET" || request.method === "HEAD")) {
    return mountJarvis(request, jarvis, "/jarvis", { shareToken: share[1] });
  }
  const admin = await verifyJarvisAdmin();
  if (!admin.ok) return denied(request, admin.status, admin.error);
  return mountJarvis(request, jarvis, "/jarvis", { buxme: "required", userId: admin.userId });
}

function denied(request: Request, status: number, error: string) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/jarvis/api") && status === 401 && request.method === "GET") {
    const login = new URL("/login", url.origin);
    login.searchParams.set("redirect", "/jarvis");
    return Response.redirect(login, 303);
  }
  const body = url.pathname.startsWith("/jarvis/api") ? JSON.stringify({ error }) : error;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": url.pathname.startsWith("/jarvis/api") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
