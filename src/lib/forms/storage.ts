/**
 * Private form storage (I4). The object path is derived only from trusted
 * server identifiers (user ID + session ID). Client-supplied paths are
 * never accepted. The original bytes are stored before a usable session
 * exists; when session creation fails the uploaded object is removed.
 */

export const FORMS_BUCKET = "omera-forms";
export const FORM_PDF_CONTENT_TYPE = "application/pdf";

export type FormsBucket = {
  upload(
    path: string,
    bytes: Blob | Uint8Array,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

export class FormStorageError extends Error {
  readonly code: "STORAGE_UPLOAD_FAILED" | "FILE_TOO_LARGE" | "STORAGE_REMOVE_FAILED";
  readonly detail: string;

  constructor(
    code: "STORAGE_UPLOAD_FAILED" | "FILE_TOO_LARGE" | "STORAGE_REMOVE_FAILED",
    detail: string,
  ) {
    super(code);
    this.name = "FormStorageError";
    this.code = code;
    this.detail = detail;
  }
}

const TRUSTED_ID = /^[A-Za-z0-9_-]{1,128}$/;

function assertTrustedId(value: string): void {
  if (!TRUSTED_ID.test(value)) throw new Error("INVALID_STORAGE_IDENTITY");
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.split("/").pop()?.split("\\").pop() ?? "form.pdf";
  const clean = base.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(0, 96);
  return clean || "form.pdf";
}

/** Derive the private object path from trusted server IDs only. */
export function buildStoragePath(input: {
  userId: string;
  sessionId: string;
  fileName: string;
}): string {
  assertTrustedId(input.userId);
  assertTrustedId(input.sessionId);
  return `${input.userId}/${input.sessionId}/${sanitizeFileName(input.fileName)}`;
}

/**
 * Resolve the storage path while rejecting any client-supplied path.
 * Pass the client value through so attempts are visible, never honored.
 */
export function resolveStoragePath(input: {
  userId: string;
  sessionId: string;
  fileName: string;
  clientPath?: unknown;
}): string {
  if (
    input.clientPath !== undefined &&
    input.clientPath !== null &&
    input.clientPath !== ""
  ) {
    throw new Error("CLIENT_PATH_REJECTED");
  }
  return buildStoragePath(input);
}

export function storageErrorDetail(error: unknown): string {
  if (!error) return "unknown storage error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      error?: unknown;
      statusCode?: unknown;
      status?: unknown;
      code?: unknown;
    };
    const parts = [
      typeof record.message === "string" ? record.message : "",
      typeof record.error === "string" ? record.error : "",
      record.statusCode != null ? `statusCode=${String(record.statusCode)}` : "",
      record.status != null ? `status=${String(record.status)}` : "",
      typeof record.code === "string" ? `code=${record.code}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown storage error";
  }
}

export function isStorageFileTooLarge(error: unknown): boolean {
  const detail = storageErrorDetail(error).toLowerCase();
  const record = error && typeof error === "object" ? (error as { status?: unknown; statusCode?: unknown }) : {};
  const status = Number(record.status ?? record.statusCode);
  return (
    status === 413 ||
    /payload too large/.test(detail) ||
    /maximum allowed size/.test(detail) ||
    /exceeded the.*size/.test(detail) ||
    /file_size_limit/.test(detail)
  );
}

function isTransientStorageError(error: unknown): boolean {
  const detail = storageErrorDetail(error).toLowerCase();
  const record = error && typeof error === "object" ? (error as { status?: unknown; statusCode?: unknown }) : {};
  const status = Number(record.status ?? record.statusCode);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /timeout|temporar|econnreset|enotfound|fetch failed|network|socket|503|502|504|429/.test(
    detail,
  );
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([Buffer.from(bytes)], { type: FORM_PDF_CONTENT_TYPE });
}

/** Store the original bytes before the session becomes usable. */
export async function storeOriginal(
  bucket: FormsBucket,
  input: {
    userId: string;
    sessionId: string;
    fileName: string;
    bytes: Uint8Array;
    contentType?: string;
  },
): Promise<string> {
  const path = buildStoragePath(input);
  const body = pdfBlob(input.bytes);
  const options = { contentType: FORM_PDF_CONTENT_TYPE, upsert: false };

  let { error } = await bucket.upload(path, body, options);
  if (error && isTransientStorageError(error)) {
    ({ error } = await bucket.upload(path, body, options));
  }
  if (error) {
    const detail = storageErrorDetail(error);
    if (isStorageFileTooLarge(error)) {
      throw new FormStorageError("FILE_TOO_LARGE", detail);
    }
    throw new FormStorageError("STORAGE_UPLOAD_FAILED", detail);
  }
  return path;
}

/** Remove an uploaded object when session creation fails. */
export async function removeStoredObject(
  bucket: FormsBucket,
  path: string,
): Promise<void> {
  const { error } = await bucket.remove([path]);
  if (error) {
    throw new FormStorageError("STORAGE_REMOVE_FAILED", storageErrorDetail(error));
  }
}
