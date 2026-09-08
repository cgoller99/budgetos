import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { playbookFromRow } from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PlaybookInput = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  goalTemplate?: unknown;
  favorite?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validFields(input: PlaybookInput) {
  const title = text(input.title);
  const description = text(input.description);
  const category = text(input.category);
  const goalTemplate = text(input.goalTemplate);
  const favorite = input.favorite === true;

  if (
    title.length < 2 ||
    title.length > 100 ||
    description.length > 500 ||
    category.length < 2 ||
    category.length > 60 ||
    goalTemplate.length < 3 ||
    goalTemplate.length > 1000
  ) {
    return null;
  }
  return { title, description, category, goalTemplate, favorite };
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as PlaybookInput | null;
  const fields = body ? validFields(body) : null;
  if (!fields) {
    return NextResponse.json({ error: "Invalid playbook." }, { status: 400 });
  }

  const { data, error } = await auth.adminSupabase
    .from("ai_team_playbooks")
    .insert({
      created_by: auth.user.id,
      title: fields.title,
      description: fields.description,
      category: fields.category,
      goal_template: fields.goalTemplate,
      favorite: fields.favorite,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[admin/ai-team/playbooks] Create failed", error);
    return NextResponse.json({ error: "Unable to create playbook." }, { status: 500 });
  }
  return NextResponse.json({ playbook: playbookFromRow(data) });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as PlaybookInput | null;
  const id = text(body?.id);
  const fields = body ? validFields(body) : null;
  if (!UUID_PATTERN.test(id) || !fields) {
    return NextResponse.json({ error: "Invalid playbook." }, { status: 400 });
  }

  const { data, error } = await auth.adminSupabase
    .from("ai_team_playbooks")
    .update({
      title: fields.title,
      description: fields.description,
      category: fields.category,
      goal_template: fields.goalTemplate,
      favorite: fields.favorite,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("created_by", auth.user.id)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to update playbook." }, { status: 500 });
  }
  return NextResponse.json({ playbook: playbookFromRow(data) });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = text(body?.id);
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid playbook." }, { status: 400 });
  }

  const { data, error } = await auth.adminSupabase
    .from("ai_team_playbooks")
    .delete()
    .eq("id", id)
    .eq("created_by", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Unable to delete playbook." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
