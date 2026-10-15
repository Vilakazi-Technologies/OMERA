import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getFormSession,
  updateFormSession,
} from "@/lib/db/form-sessions";
import { fillPdfFields } from "@/lib/forms/pdf-fields";
import {
  validateAnswerPatch,
  type CanonicalFieldDef,
} from "@/lib/forms/contracts";
import { FORMS_BUCKET } from "@/lib/forms/storage";

type Params = { params: Promise<{ id: string }> };

const APPROVED_FONT_PATH = join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSans-Regular.ttf",
);
const EXPORT_RESPONSE_LIMIT = 8000000;

const FILL_ERRORS = new Set([
  "REQUIRED_FIELD",
  "INVALID_TEXT",
  "INVALID_CHECKBOX",
  "INVALID_CHOICE",
  "VALUE_TOO_LONG",
  "UNKNOWN_FIELD",
  "FIELD_TYPE_MISMATCH",
  "UNSUPPORTED_CHARACTER",
  "INVALID_PDF",
  "INVALID_PDF_SIZE",
  "PDF_PAGE_LIMIT",
  "PDF_FIELD_LIMIT",
  "NO_FILLABLE_FIELDS",
  "UNSUPPORTED_XFA",
  "UNSUPPORTED_FIELD_TYPE",
  "SIGNATURE_REQUIRES_REVIEW",
]);

function safeFileName(fileName: string): string {
  const base =
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80) || "form";
  return `${base}-completed.pdf`;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    const { id } = await params;
    const session = await getFormSession(id, identity.userId);
    if (!session) throw new ApiError("NOT_FOUND", 404);
    if (!session.storagePath || !session.documentSha256) {
      throw new ApiError("OBJECT_NOT_FOUND", 404);
    }

    const bucket = getSupabaseAdmin().storage.from(FORMS_BUCKET);
    const { data, error } = await bucket.download(session.storagePath);
    if (error || !data) throw new ApiError("OBJECT_NOT_FOUND", 404);
    const original = new Uint8Array(await data.arrayBuffer());

    const digest = createHash("sha256").update(original).digest("hex");
    if (digest !== session.documentSha256) {
      await updateFormSession(id, identity.userId, {
        status: "review",
      }).catch(() => undefined);
      throw new ApiError("DOCUMENT_MISMATCH", 422);
    }

    const answers: Record<string, string | boolean> = {};
    for (const field of session.fields) {
      const raw = (field as { value?: unknown }).value;
      if (field.kind === "checkbox") {
        answers[field.id] = raw === true || raw === "true";
      } else {
        answers[field.id] = typeof raw === "string" ? raw : "";
      }
    }

    // Required completeness is enforced here, not during incremental
    // saves: an incomplete session cannot produce a completed PDF.
    try {
      const defs: CanonicalFieldDef[] = session.fields.map((field) => ({
        id: field.id,
        kind: field.kind ?? "text",
        required: field.required,
        options: field.options,
      }));
      validateAnswerPatch(defs, answers);
    } catch (validationError) {
      await updateFormSession(id, identity.userId, {
        status: "review",
      }).catch(() => undefined);
      throw new ApiError(
        validationError instanceof Error
          ? validationError.message
          : "INCOMPLETE_FORM",
        422,
      );
    }

    let filled: Uint8Array;
    try {
      const fontBytes = new Uint8Array(await readFile(APPROVED_FONT_PATH));
      filled = await fillPdfFields(original, answers, fontBytes);
    } catch (fillError) {
      await updateFormSession(id, identity.userId, {
        status: "review",
      }).catch(() => undefined);
      const code =
        fillError instanceof Error && FILL_ERRORS.has(fillError.message)
          ? fillError.message
          : "EXPORT_FAILED";
      throw new ApiError(code, 422);
    }

    if (filled.length > EXPORT_RESPONSE_LIMIT) {
      await updateFormSession(id, identity.userId, {
        status: "review",
      }).catch(() => undefined);
      throw new ApiError("EXPORT_TOO_LARGE", 502);
    }

    await updateFormSession(id, identity.userId, { status: "completed" });

    return auth.applyCookies(
      new NextResponse(Buffer.from(filled), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFileName(session.fileName)}"`,
          "Cache-Control": "private, no-store",
          "Content-Length": String(filled.length),
        },
      }),
    );
  } catch (routeError) {
    return apiErrorResponse(routeError);
  }
}
