import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be under 15MB." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const prefix = kind === "recording" ? "recording" : "screenshot";
  const path = `${user.id}/${prefix}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("feedback-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error("[feedback/upload] Failed", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("feedback-attachments").getPublicUrl(path);

  return NextResponse.json({
    path,
    url: publicUrl.publicUrl,
  });
}
