import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  FormAnswerValue,
  FormDocumentKind,
  FormDocumentStatus,
} from "@/lib/forms/contracts";
import type { FormField, FormSession } from "@/lib/types";

export type StoredFormField = FormField & {
  kind?: "text" | "checkbox" | "choice";
  options?: string[];
};

export type FormSessionRecord = {
  id: string;
  fileName: string;
  storagePath: string | null;
  fields: StoredFormField[];
  currentIndex: number;
  languageId: string;
  documentSha256: string | null;
  documentKind: FormDocumentKind | null;
  revision: number;
  status: FormDocumentStatus;
};

const FULL_COLUMNS =
  "id, file_name, storage_path, fields_json, current_index, language_id, document_sha256, document_kind, revision, status";

function toRecord(data: {
  id: string;
  file_name: string;
  storage_path: string | null;
  fields_json: StoredFormField[];
  current_index: number;
  language_id: string;
  document_sha256: string | null;
  document_kind: FormDocumentKind | null;
  revision: number;
  status: FormDocumentStatus;
}): FormSessionRecord {
  return {
    id: data.id,
    fileName: data.file_name,
    storagePath: data.storage_path,
    fields: data.fields_json,
    currentIndex: data.current_index,
    languageId: data.language_id,
    documentSha256: data.document_sha256,
    documentKind: data.document_kind,
    revision: data.revision,
    status: data.status,
  };
}

export async function createFormSession(input: {
  userId: string;
  fileName: string;
  storagePath?: string | null;
  fields: StoredFormField[];
  languageId: string;
  conversationId?: string;
  documentSha256?: string | null;
  documentKind?: FormDocumentKind | null;
  status?: FormDocumentStatus;
}): Promise<FormSessionRecord> {
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
      document_sha256: input.documentSha256 ?? null,
      document_kind: input.documentKind ?? null,
      revision: 1,
      status: input.status ?? "in_progress",
    })
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;

  return toRecord(
    data as unknown as Parameters<typeof toRecord>[0],
  );
}

export async function updateFormSession(
  sessionId: string,
  userId: string,
  patch: {
    fields?: StoredFormField[];
    currentIndex?: number;
    status?: FormDocumentStatus;
    revision?: number;
  },
): Promise<FormSessionRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .update({
      fields_json: patch.fields,
      current_index: patch.currentIndex,
      status: patch.status,
      revision: patch.revision,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  return toRecord(
    data as unknown as Parameters<typeof toRecord>[0],
  );
}

export async function applyAnswerPatch(
  sessionId: string,
  userId: string,
  patch: {
    fields: StoredFormField[];
    currentIndex?: number;
    status?: FormDocumentStatus;
    revision: number;
  },
): Promise<FormSessionRecord> {
  return updateFormSession(sessionId, userId, patch);
}

export async function getFormSession(
  sessionId: string,
  userId: string,
): Promise<FormSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .select(FULL_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toRecord(
    data as unknown as Parameters<typeof toRecord>[0],
  );
}

export async function listFormSessions(
  userId: string,
): Promise<FormSessionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_form_sessions")
    .select(FULL_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Parameters<typeof toRecord>[0][]).map(
    toRecord,
  );
}

export async function deleteFormSession(
  sessionId: string,
  userId: string,
): Promise<{ deleted: boolean; storagePath: string | null }> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: readError } = await supabase
    .from("omera_form_sessions")
    .select("id, storage_path")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return { deleted: false, storagePath: null };
  const { error: deleteError } = await supabase
    .from("omera_form_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  return {
    deleted: true,
    storagePath: (existing as { storage_path: string | null }).storage_path,
  };
}

export type { FormAnswerValue, FormSession };
