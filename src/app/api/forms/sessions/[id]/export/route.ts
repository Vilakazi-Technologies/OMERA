import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getFormSession,
  updateFormSession,
} from "@/lib/db/form-sessions";
import { fillPdfFields } from "@/lib/forms/pdf-fields";
import {
  appendAnswersSummaryPdf,
  buildAnswersOnlyPdf,
} from "@/lib/forms/pdf-answers-appendix";
import { buildCompletedDocx } from "@/lib/forms/completed-docx";
import { classifyReceivedFile } from "@/lib/forms/received-document";
import {
  validateAnswerPatch,
  type CanonicalFieldDef,
} from "@/lib/forms/contracts";
import { FORMS_BUCKET } from "@/lib/forms/storage";

export const maxDuration = 60;

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
  "ENCRYPTED_PDF",
]);

function safeFileName(fileName: string, extension: "pdf" | "docx"): string {
  const base =
    fileName
      .replace(/\.(pdf|docx?)$/i, "")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80) || "form";
  return `${base}-completed.${extension}`;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const identity = await requireIdentity();
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

    const fontBytes = new Uint8Array(await readFile(APPROVED_FONT_PATH));
    const received = classifyReceivedFile({
      fileName: session.fileName,
      contentType: "",
      bytes: original,
    });
    const word = received?.kind === "doc" || received?.kind === "docx";

    let filled: Uint8Array;
    let exportMode: "acroform" | "appendix" | "docx" | "answers-pdf" = "acroform";
    let contentType = "application/pdf";
    let downloadName = safeFileName(session.fileName, "pdf");

    if (word) {
      try {
        filled = await buildCompletedDocx({
          fileName: session.fileName,
          fields: session.fields,
          answers,
        });
        exportMode = "docx";
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        downloadName = safeFileName(session.fileName, "docx");
      } catch (error) {
        console.error(
          "[forms/export] DOCX_EXPORT_FAILED",
          error instanceof Error ? error.name : "UnknownError",
        );
        filled = await buildAnswersOnlyPdf(session.fields, answers, fontBytes);
        exportMode = "answers-pdf";
      }
    } else if (session.documentKind === "flat") {
      filled = await appendAnswersSummaryPdf(
        original,
        session.fields,
        answers,
        fontBytes,
      );
      exportMode = "appendix";
    } else {
      try {
        filled = await fillPdfFields(original, answers, fontBytes);
      } catch (fillError) {
        const code =
          fillError instanceof Error && FILL_ERRORS.has(fillError.message)
            ? fillError.message
            : "EXPORT_FAILED";
        if (
          code === "NO_FILLABLE_FIELDS" ||
          code === "PDF_PAGE_LIMIT" ||
          code === "PDF_FIELD_LIMIT" ||
          code === "VALUE_TOO_LONG" ||
          code === "EXPORT_FAILED"
        ) {
          filled = await appendAnswersSummaryPdf(
            original,
            session.fields,
            answers,
            fontBytes,
          );
          exportMode = "appendix";
        } else {
          await updateFormSession(id, identity.userId, {
            status: "review",
          }).catch(() => undefined);
          throw new ApiError(code, 422);
        }
      }
    }

    if (filled.length > EXPORT_RESPONSE_LIMIT) {
      await updateFormSession(id, identity.userId, {
        status: "review",
      }).catch(() => undefined);
      throw new ApiError("EXPORT_TOO_LARGE", 502);
    }

    await updateFormSession(id, identity.userId, { status: "completed" });

    return new NextResponse(Buffer.from(filled), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "private, no-store",
        "X-Form-Export-Mode": exportMode,
        "Content-Length": String(filled.length),
      },
    });
  } catch (routeError) {
    return apiErrorResponse(routeError);
  }
}
