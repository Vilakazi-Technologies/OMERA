/**
 * Private form storage (I4). The object path is derived only from trusted
 * server identifiers (user ID + session ID). Client-supplied paths are
 * never accepted. The original bytes are stored before a usable session
 * exists; when session creation fails the uploaded object is removed.
 */

export const FORMS_BUCKET = "omera-forms";

export type FormsBucket = {
  upload(
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: false },
  ): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

const TRUSTED_ID = /^[A-Za-z0-9-]{1,64}$/;

function assertTrustedId(name: string, value: string): void {
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
  assertTrustedId("userId", input.userId);
  assertTrustedId("sessionId", input.sessionId);
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

/** Store the original bytes before the session becomes usable. */
export async function storeOriginal(
  bucket: FormsBucket,
  input: {
    userId: string;
    sessionId: string;
    fileName: string;
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<string> {
  const path = buildStoragePath(input);
  const { error } = await bucket.upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) throw new Error("STORAGE_UPLOAD_FAILED");
  return path;
}

/** Remove an uploaded object when session creation fails. */
export async function removeStoredObject(
  bucket: FormsBucket,
  path: string,
): Promise<void> {
  const { error } = await bucket.remove([path]);
  if (error) throw new Error("STORAGE_REMOVE_FAILED");
}
