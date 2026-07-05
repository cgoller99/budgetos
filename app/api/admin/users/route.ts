import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { searchAdminUsers } from "@/lib/admin/userService";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const query = new URL(request.url).searchParams.get("q") ?? "";

  try {
    const users = await searchAdminUsers(auth.adminSupabase, query);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[admin/users] Failed", error);
    return NextResponse.json({ error: "Unable to search users." }, { status: 500 });
  }
}
