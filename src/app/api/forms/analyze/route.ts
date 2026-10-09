import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { getUserIdFromCookies } from "@/lib/auth/session";
import { createFormSession } from "@/lib/db/form-sessions";
import { extractFormFields } from "@/lib/forms/extract-fields";
import { extractTextFromPdf } from "@/lib/forms/pdf-text";
import { analyzeFormDemo } from "@/lib/form-demo";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const languageId = (formData.get("languageId") as string) || "eng";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let documentText = "";
  let storagePath: string | undefined;

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      documentText = await extractTextFromPdf(buffer);
    } catch {
      documentText = "";
    }
  }

  let fields = documentText
    ? await extractFormFields(file.name, documentText)
    : analyzeFormDemo(file.name);

  const userId = isSupabaseConfigured() ? await getUserIdFromCookies() : null;

  if (userId && isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("omera-forms")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (!uploadError) storagePath = path;

    const session = await createFormSession({
      userId,
      fileName: file.name,
      storagePath,
      fields,
      languageId,
    });

    return NextResponse.json({
      fileName: file.name,
      fields: session.fields,
      sessionId: session.id,
      message:
        "I've read your form. I'll ask you each question in text — answer with your voice or keyboard.",
    });
  }

  return NextResponse.json({
    fileName: file.name,
    fields,
    message:
      "I've read your form. I'll ask you each question in text — answer with your voice or keyboard.",
  });
}
