import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FormField, FormSession } from "@/lib/types";

export async function createFormSession(input: {
  userId: string;
  fileName: string;
  storagePath?: string;
  fields: FormField[];
  languageId: string;
  conversationId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .insert({
      user_id: input.userId,
      file_name: input.fileName,
      storage_path: input.storagePath ?? null,
      fields_json: input.fields,
      current_index: 0,
      language_id: input.languageId,
      conversation_id: input.conversationId ?? null,
      status: "in_progress",
    })
    .select("id, file_name, fields_json, current_index, language_id")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    fileName: data.file_name as string,
    fields: data.fields_json as FormField[],
    currentIndex: data.current_index as number,
    languageId: data.language_id as string,
  } satisfies FormSession;
}

export async function updateFormSession(
  sessionId: string,
  userId: string,
  patch: {
    fields?: FormField[];
    currentIndex?: number;
    status?: "in_progress" | "completed";
  },
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .update({
      fields_json: patch.fields,
      current_index: patch.currentIndex,
      status: patch.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id, file_name, fields_json, current_index, language_id, status")
    .single();

  if (error) throw error;
  return data;
}

export async function getFormSession(sessionId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .select("id, file_name, fields_json, current_index, language_id, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    fileName: data.file_name as string,
    fields: data.fields_json as FormField[],
    currentIndex: data.current_index as number,
    languageId: data.language_id as string,
  } satisfies FormSession;
}
