import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { allowRequest } from "@/lib/limits/rate-limit";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { createFormSession } from "@/lib/db/form-sessions";
import { extractFormFields } from "@/lib/forms/extract-fields";
import { inferFormFieldsFromDocument } from "@/lib/forms/infer-form-fields";
import { inferFieldsFromExtractedText } from "@/lib/forms/infer-from-text";
import { mergeFillFields } from "@/lib/forms/merge-fill-fields";
import { inspectPdfFields } from "@/lib/forms/pdf-fields";
import { extractPdfDocument } from "@/lib/forms/pdf-text";
import { buildDocumentBrief } from "@/lib/forms/document-brief";
import {
  defaultWhatWasRead,
  fallbackDocumentBrief,
  type FormDocumentBrief,
} from "@/lib/forms/document-brief-schema";
import { classifyReceivedFile } from "@/lib/forms/received-document";
import { prepareTextForm } from "@/lib/forms/text-session";
import {
  FORM_PDF_FILE_LIMIT,
  FORM_PDF_MULTIPART_LIMIT,
} from "@/lib/forms/pdf-limits";
import type { FormDocumentKind } from "@/lib/forms/contracts";
import type { StoredFormField } from "@/lib/db/form-sessions";
import { fallbackFormFields } from "@/lib/forms/field-labels";
import { NO_FILL_IN_PLACES_MESSAGE } from "@/lib/forms/form-errors";
import {
  FORMS_BUCKET,
  FormStorageError,
  removeStoredObject,
  storeOriginal,
} from "@/lib/forms/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MULTIPART_LIMIT = FORM_PDF_MULTIPART_LIMIT;
const FILE_LIMIT = FORM_PDF_FILE_LIMIT;
type UploadedFile = {
  fieldName: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

function parseMultipart(
  bytes: Uint8Array,
  contentTypeHeader: string | null,
): { fields: Map<string, string>; file: UploadedFile | null } {
  const match = /boundary=([^;]+)/i.exec(contentTypeHeader ?? "");
  if (!match) throw new ApiError("INVALID_MULTIPART", 400);
  let boundary = match[1].trim();
  if (boundary.startsWith('"') && boundary.endsWith('"')) {
    boundary = boundary.slice(1, -1);
  }
  if (!boundary || boundary.length > 200 || /[\r\n]/.test(boundary)) {
    throw new ApiError("INVALID_MULTIPART", 400);
  }
  const buf = Buffer.from(bytes);
  const delimiter = Buffer.from(`--${boundary}`);
  const sections: Buffer[] = [];
  let cursor = 0;
  while (true) {
    const start = buf.indexOf(delimiter, cursor);
    if (start === -1) break;
    const after = start + delimiter.length;
    if (buf.subarray(after, after + 2).toString("ascii") === "--") break;
    cursor = after;
    const next = buf.indexOf(delimiter, cursor);
    if (next === -1) throw new ApiError("INVALID_MULTIPART", 400);
    sections.push(buf.subarray(cursor, next));
    cursor = next;
  }
  if (!sections.length) throw new ApiError("INVALID_MULTIPART", 400);

  const fields = new Map<string, string>();
  let file: UploadedFile | null = null;
  for (const section of sections) {
    let part = section;
    if (part.subarray(0, 2).toString("ascii") === "\r\n") {
      part = part.subarray(2);
    }
    if (
      part.length >= 2 &&
      part.subarray(part.length - 2).toString("ascii") === "\r\n"
    ) {
      part = part.subarray(0, part.length - 2);
    }
    const split = part.indexOf(Buffer.from("\r\n\r\n"));
    if (split === -1) throw new ApiError("INVALID_MULTIPART", 400);
    const headerText = part.subarray(0, split).toString("latin1");
    const body = new Uint8Array(
      part.buffer.slice(
        part.byteOffset + split + 4,
        part.byteOffset + part.length,
      ),
    );
    const disposition = /^content-disposition:\s*form-data;\s*(.*)$/im.exec(
      headerText,
    )?.[1];
    if (!disposition) throw new ApiError("INVALID_MULTIPART", 400);
    const name = /name="([^"]*)"/.exec(disposition)?.[1];
    if (!name) throw new ApiError("INVALID_MULTIPART", 400);
    const fileName = /filename="([^"]*)"/.exec(disposition)?.[1];
    if (fileName === undefined) {
      fields.set(name, Buffer.from(body).toString("utf-8"));
    } else {
      if (file) throw new ApiError("MULTIPLE_FILES", 400);
      const partType =
        /^content-type:\s*([^\r\n;]+)/im.exec(headerText)?.[1].trim().toLowerCase() ??
        "application/octet-stream";
      file = { fieldName: name, fileName, contentType: partType, bytes: body };
    }
  }
  return { fields, file };
}

const PDF_ERRORS = new Set([
  "INVALID_PDF",
  "INVALID_PDF_SIZE",
  "PDF_PAGE_LIMIT",
  "PDF_FIELD_LIMIT",
  "NO_FILLABLE_FIELDS",
  "UNSUPPORTED_XFA",
  "UNSUPPORTED_FIELD_TYPE",
  "ENCRYPTED_PDF",
]);

/** Missing AcroForm, over-long packs, or odd widgets still get a text/vision path. */
const INFER_FALLBACK = new Set([
  "NO_FILLABLE_FIELDS",
  "PDF_PAGE_LIMIT",
  "PDF_FIELD_LIMIT",
  "UNSUPPORTED_FIELD_TYPE",
  "INVALID_PDF",
  "MALFORMED_PDF",
]);

async function publishAnalyzedUpload(input: {
  userId: string;
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
  fields: StoredFormField[];
  languageId: string;
  documentKind: FormDocumentKind;
  brief: FormDocumentBrief;
  truncated: boolean;
  pageCount: number;
  message: string;
}) {
  const documentSha256 = createHash("sha256").update(input.bytes).digest("hex");
  const sessionId = randomUUID();
  const bucket = getSupabaseAdmin().storage.from(FORMS_BUCKET);
  let storagePath: string;
  try {
    storagePath = await storeOriginal(bucket, {
      userId: input.userId,
      sessionId,
      fileName: input.fileName,
      bytes: input.bytes,
      contentType: input.contentType,
    });
  } catch (error) {
    console.error(
      "[forms/analyze] STORAGE_UPLOAD_FAILED",
      error instanceof FormStorageError
        ? error.code
        : error instanceof Error
          ? error.name
          : "UnknownError",
    );
    if (error instanceof FormStorageError && error.code === "FILE_TOO_LARGE") {
      throw new ApiError("FILE_TOO_LARGE", 413);
    }
    throw new ApiError("STORAGE_UPLOAD_FAILED", 502);
  }

  try {
    const session = await createFormSession({
      userId: input.userId,
      fileName: input.fileName,
      storagePath,
      fields: input.fields,
      languageId: input.languageId,
      documentSha256,
      documentKind: input.documentKind,
      brief: input.brief,
    });
    return NextResponse.json(
      {
        sessionId: session.id,
        fileName: session.fileName,
        fields: session.fields,
        revision: session.revision,
        status: session.status,
        brief: session.brief ?? input.brief,
        truncated: input.truncated,
        pageCount: input.pageCount,
        hasFillableQuestions: input.fields.length > 0,
        message: input.message,
      },
      { status: 201 },
    );
  } catch (error) {
    await removeStoredObject(bucket, storagePath).catch(() => undefined);
    throw new ApiError(
      error instanceof ApiError ? error.code : "SESSION_CREATE_FAILED",
      error instanceof ApiError ? error.status : 502,
    );
  }
}

function classifyInspectError(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error && PDF_ERRORS.has(error.message)) return error.message;
  if (
    error instanceof Error &&
    (error.name === "EncryptedPDFError" || /encrypt/i.test(error.message))
  ) {
    return "ENCRYPTED_PDF";
  }
  return "MALFORMED_PDF";
}

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(request);
    if (!allowRequest(`forms-analyze:${identity.userId}`, 10, 60_000)) {
      throw new ApiError("RATE_LIMITED", 429);
    }
    if (!isSupabaseConfigured()) {
      throw new ApiError("FORMS_STORAGE_UNAVAILABLE", 503);
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
      throw new ApiError("INVALID_MULTIPART", 400);
    }
    const raw = await readBody(request, MULTIPART_LIMIT);
    const { fields, file } = parseMultipart(raw, contentType);
    if (!file) throw new ApiError("NO_FILE", 400);
    if (file.bytes.length > FILE_LIMIT) {
      throw new ApiError("FILE_TOO_LARGE", 413);
    }
    if (file.bytes.length === 0) throw new ApiError("EMPTY_FILE", 400);
    const received = classifyReceivedFile({
      fileName: file.fileName,
      contentType: file.contentType,
      bytes: file.bytes,
    });
    if (!received) throw new ApiError("UNSUPPORTED_FORMAT", 415);

    const languageId = (fields.get("languageId") ?? "eng").trim() || "eng";
    const fileName =
      file.fileName ||
      (received.kind === "docx"
        ? "form.docx"
        : received.kind === "doc"
          ? "form.doc"
          : "form.pdf");

    if (received.kind !== "pdf" || !received.trustedPdf) {
      const prepared = await prepareTextForm({
        kind: received.kind,
        bytes: file.bytes,
        fileName,
        languageId,
      });
      return await publishAnalyzedUpload({
        userId: identity.userId,
        fileName,
        bytes: file.bytes,
        contentType: file.contentType,
        fields: prepared.fields,
        languageId,
        documentKind: "flat",
        brief: prepared.brief,
        truncated: false,
        pageCount: prepared.thin ? 0 : 1,
        message: prepared.message,
      });
    }
    let extracted: Awaited<ReturnType<typeof extractPdfDocument>>;
    try {
      extracted = await extractPdfDocument(Buffer.from(file.bytes));
    } catch (error) {
      const code = error instanceof Error ? error.message : "MALFORMED_PDF";
      console.error(
        "[forms/analyze] PDF_TEXT_EXTRACT_FAILED",
        error instanceof Error ? error.name : "UnknownError",
      );
      if (code === "ENCRYPTED_PDF") throw new ApiError("ENCRYPTED_PDF", 422);
      extracted = {
        pages: [],
        text: "",
        totalPages: 0,
        truncated: false,
      };
    }

    let interpreted: StoredFormField[];
    let documentKind: FormDocumentKind = "acroform";
    try {
      const inspected = await inspectPdfFields(file.bytes);
      try {
        interpreted = await extractFormFields(inspected, { languageId });
      } catch {
        interpreted = fallbackFormFields(inspected);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code !== "NO_FILLABLE_FIELDS") {
        throw error;
      }
      const code = classifyInspectError(error);
      if (!INFER_FALLBACK.has(code)) throw new ApiError(code, 422);
      try {
        interpreted = await inferFormFieldsFromDocument(file.bytes, {
          languageId,
          document: extracted,
        });
      } catch {
        interpreted = [];
      }
      documentKind = "flat";
    }
    interpreted = mergeFillFields(
      interpreted,
      inferFieldsFromExtractedText(extracted.text),
    );

    const fieldHints = interpreted.map((field) => ({
      label: field.label,
      kind: field.kind,
    }));
    const coverage = defaultWhatWasRead(
      extracted.pages.length,
      extracted.totalPages,
      extracted.truncated,
    );
    const brief = await buildDocumentBrief(extracted.text, {
      languageId,
      fileName,
      pagesRead: extracted.pages.length,
      pageCount: extracted.totalPages,
      truncated: extracted.truncated,
      fields: fieldHints,
    }).catch(() =>
      fallbackDocumentBrief({
        fileName,
        fieldLabels: fieldHints.map((field) => field.label),
        coverage,
      }),
    );
    const hasFillableQuestions = interpreted.length > 0;

    const documentSha256 = createHash("sha256")
      .update(file.bytes)
      .digest("hex");
    const sessionId = randomUUID();
    const bucket = getSupabaseAdmin().storage.from(FORMS_BUCKET);

    let storagePath: string;
    try {
      storagePath = await storeOriginal(bucket, {
        userId: identity.userId,
        sessionId,
        fileName,
        bytes: file.bytes,
        contentType: "application/pdf",
      });
    } catch (error) {
      console.error(
        "[forms/analyze] STORAGE_UPLOAD_FAILED",
        error instanceof FormStorageError
          ? error.code
          : error instanceof Error
            ? error.name
            : "UnknownError",
      );
      if (error instanceof FormStorageError && error.code === "FILE_TOO_LARGE") {
        throw new ApiError("FILE_TOO_LARGE", 413);
      }
      throw new ApiError("STORAGE_UPLOAD_FAILED", 502);
    }

    try {
      const session = await createFormSession({
        userId: identity.userId,
        fileName,
        storagePath,
        fields: interpreted,
        languageId,
        documentSha256,
        documentKind,
        brief,
      });
      return NextResponse.json(
        {
          sessionId: session.id,
          fileName: session.fileName,
          fields: session.fields,
          revision: session.revision,
          status: session.status,
          brief: session.brief ?? brief,
          truncated: extracted.truncated,
          pageCount: extracted.totalPages,
          hasFillableQuestions,
          message: hasFillableQuestions
            ? "I've read your document. Confirm to start filling — I will only ask the questions on the form."
            : NO_FILL_IN_PLACES_MESSAGE,
        },
        { status: 201 },
      );
    } catch (error) {
      await removeStoredObject(bucket, storagePath).catch(() => undefined);
      throw new ApiError(
        error instanceof ApiError ? error.code : "SESSION_CREATE_FAILED",
        error instanceof ApiError ? error.status : 502,
      );
    }
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "SERVICE_UNAVAILABLE";
    console.error(
      "[forms/analyze]",
      code,
      error instanceof Error ? error.name : "UnknownError",
    );
    return apiErrorResponse(error);
  }
}
