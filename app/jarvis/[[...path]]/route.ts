import { createApp } from "../../../apps/jarvis/lib/app.mjs";
import { dashboardAssets, mountJarvis } from "../../../apps/jarvis/lib/mount.mjs";

void dashboardAssets.length;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jarvis = createApp({
  dataDir: process.env.JARVIS_DATA_DIR || (process.env.VERCEL === "1" ? "/tmp/jarvis" : undefined),
});

async function handle(request: Request) {
  return mountJarvis(request, jarvis);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
