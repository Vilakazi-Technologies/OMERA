import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { createFormSession } from "@/lib/db/form-sessions";
import { extractFormFields } from "@/lib/forms/extract-fields";
import { inspectPdfFields } from "@/lib/forms/pdf-fields";
import {
  FORMS_BUCKET,
  removeStoredObject,
  storeOriginal,
} from "@/lib/forms/storage";

export const runtime = "nodejs";

const MULTIPART_LIMIT = 4100000;
const FILE_LIMIT = 4000000;
const PDF_MIME = "application/pdf";

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
  "SIGNATURE_REQUIRES_REVIEW",
]);

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(request);
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
    if (file.contentType !== PDF_MIME) {
      throw new ApiError("UNSUPPORTED_FORMAT", 415);
    }
    if (
      file.bytes.length < 5 ||
      new TextDecoder().decode(file.bytes.slice(0, 5)) !== "%PDF-"
    ) {
      throw new ApiError("MALFORMED_PDF", 422);
    }

    const languageId = (fields.get("languageId") ?? "eng").trim() || "eng";

    let inspected;
    try {
      inspected = await inspectPdfFields(file.bytes);
    } catch (error) {
      const code =
        error instanceof Error && PDF_ERRORS.has(error.message)
          ? error.message
          : "MALFORMED_PDF";
      throw new ApiError(code, 422);
    }

    let interpreted;
    try {
      interpreted = await extractFormFields(inspected, { languageId });
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "FORM_TRANSLATION_FAILED",
        502,
      );
    }

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
        fileName: file.fileName || "form.pdf",
        bytes: file.bytes,
        contentType: PDF_MIME,
      });
    } catch {
      throw new ApiError("STORAGE_UPLOAD_FAILED", 502);
    }

    try {
      const session = await createFormSession({
        userId: identity.userId,
        fileName: file.fileName || "form.pdf",
        storagePath,
        fields: interpreted,
        languageId,
        documentSha256,
        documentKind: "acroform",
      });
      return NextResponse.json(
        {
          sessionId: session.id,
          fileName: session.fileName,
          fields: session.fields,
          revision: session.revision,
          status: session.status,
          message:
            "I've read your form. I'll ask you each question in text — answer with your voice or keyboard.",
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
    return apiErrorResponse(error);
  }
}
