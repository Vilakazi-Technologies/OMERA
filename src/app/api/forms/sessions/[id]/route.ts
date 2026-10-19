import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  validateSubmittedAnswers,
  type CanonicalFieldDef,
  type FormAnswerValue,
} from "@/lib/forms/contracts";
import {
  applyAnswerPatch,
  deleteFormSession,
  getFormSession,
  type FormSessionRecord,
  type StoredFormField,
} from "@/lib/db/form-sessions";
import { FORMS_BUCKET } from "@/lib/forms/storage";

type Params = { params: Promise<{ id: string }> };

export function toClientSession(session: FormSessionRecord) {
  return {
    id: session.id,
    fileName: session.fileName,
    fields: session.fields,
    currentIndex: session.currentIndex,
    languageId: session.languageId,
    revision: session.revision,
    status: session.status,
    documentKind: session.documentKind,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Checkbox booleans persist in jsonb; readers narrow them at runtime. */
type PatchedStoredField = Omit<StoredFormField, "value"> & {
  value?: string | boolean;
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const identity = await requireIdentity();
    const { id } = await params;
    const session = await getFormSession(id, identity.userId);
    if (!session) throw new ApiError("NOT_FOUND", 404);
    return NextResponse.json({ session: toClientSession(session) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(req);
    const raw = await readJsonBody(req);
    if (!isRecord(raw)) throw new ApiError("INVALID_PATCH", 400);
    // Answer patches only: stored definitions and document metadata are
    // never writable from the client.
    for (const key of [
      "fields",
      "storagePath",
      "documentSha256",
      "documentKind",
      "status",
    ]) {
      if (raw[key] !== undefined) throw new ApiError("CLIENT_METADATA_REJECTED", 400);
    }
    const { answers, revision, currentIndex } = raw;
    if (!isRecord(answers) || typeof revision !== "number") {
      throw new ApiError("INVALID_PATCH", 400);
    }
    const { id } = await params;
    const session = await getFormSession(id, identity.userId);
    if (!session) throw new ApiError("NOT_FOUND", 404);
    if (revision !== session.revision) {
      throw new ApiError("REVISION_CONFLICT", 409);
    }

    const defs: CanonicalFieldDef[] = session.fields.map((field) => ({
      id: field.id,
      kind: field.kind ?? "text",
      required: field.required,
      options: field.options,
    }));
    const known = new Set(defs.map((def) => def.id));
    for (const id of Object.keys(answers)) {
      if (!known.has(id)) throw new ApiError("UNKNOWN_ANSWER_ID", 400);
    }
    // Incremental progress: only the submitted subset is validated here.
    // Required completeness is enforced at export, so a partially
    // answered form can always be saved.
    const submitted: Record<string, FormAnswerValue> = {};
    for (const id of Object.keys(answers)) {
      submitted[id] = answers[id] as FormAnswerValue;
    }
    try {
      validateSubmittedAnswers(defs, submitted);
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "INVALID_ANSWER",
        400,
      );
    }

    const merged: PatchedStoredField[] = session.fields.map((field) =>
      Object.prototype.hasOwnProperty.call(answers, field.id)
        ? { ...field, value: answers[field.id] as string | boolean }
        : field,
    );
    const nextIndex =
      typeof currentIndex === "number"
        ? Math.max(0, Math.min(session.fields.length, Math.floor(currentIndex)))
        : session.currentIndex;
    const updated = await applyAnswerPatch(id, identity.userId, {
      fields: merged as StoredFormField[],
      currentIndex: nextIndex,
      revision: session.revision + 1,
      // Newer answers invalidate a previously completed PDF: reopen the
      // session so export must run again instead of serving stale output.
      ...(session.status === "completed" ? { status: "review" as const } : {}),
    });
    return NextResponse.json({
      session: toClientSession(updated),
      revision: updated.revision,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(_req);
    const { id } = await params;
    const session = await getFormSession(id, identity.userId);
    if (!session) throw new ApiError("NOT_FOUND", 404);
    const removed = await deleteFormSession(id, identity.userId);
    if (!removed.deleted) throw new ApiError("NOT_FOUND", 404);
    if (removed.storagePath) {
      const bucket = getSupabaseAdmin().storage.from(FORMS_BUCKET);
      let failure: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await bucket.remove([removed.storagePath]);
        if (!error) {
          failure = null;
          break;
        }
        failure = error;
      }
      if (failure) throw new ApiError("OBJECT_DELETE_FAILED", 502);
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
