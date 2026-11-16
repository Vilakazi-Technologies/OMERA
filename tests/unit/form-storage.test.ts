import { expect, it, vi } from "vitest";
import {
  FORM_PDF_CONTENT_TYPE,
  FormStorageError,
  buildStoragePath,
  isStorageFileTooLarge,
  removeStoredObject,
  resolveStoragePath,
  storageErrorDetail,
  storeOriginal,
  type FormsBucket,
} from "@/lib/forms/storage";

function fakeBucket(options: {
  failTimes?: number;
  error?: unknown;
} = {}): FormsBucket & {
  uploaded: string[];
  removed: string[];
  contentTypes: string[];
  bodies: Array<Blob | Uint8Array>;
} {
  const state = {
    uploaded: [] as string[],
    removed: [] as string[],
    contentTypes: [] as string[],
    bodies: [] as Array<Blob | Uint8Array>,
    remainingFails: options.failTimes ?? 0,
  };
  return {
    uploaded: state.uploaded,
    removed: state.removed,
    contentTypes: state.contentTypes,
    bodies: state.bodies,
    upload: vi.fn(async (path: string, bytes: Blob | Uint8Array, opts: { contentType: string }) => {
      state.bodies.push(bytes);
      state.contentTypes.push(opts.contentType);
      if (state.remainingFails > 0) {
        state.remainingFails -= 1;
        return { error: options.error ?? { message: "fetch failed", statusCode: 503 } };
      }
      state.uploaded.push(path);
      return { error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      state.removed.push(...paths);
      return { error: null };
    }),
  };
}

it("the_path_uses_trusted_identifiers", async () => {
  const bucket = fakeBucket();
  const path = await storeOriginal(bucket, {
    userId: "omera-user-1",
    sessionId: "session-9",
    fileName: "My Form (final).pdf",
    bytes: new Uint8Array([37, 80, 68, 70]),
    contentType: "application/pdf",
  });
  expect(path).toBe("omera-user-1/session-9/My_Form_final_.pdf");
  expect(bucket.uploaded).toEqual([path]);
  expect(() =>
    buildStoragePath({
      userId: "../evil",
      sessionId: "session-9",
      fileName: "form.pdf",
    }),
  ).toThrow("INVALID_STORAGE_IDENTITY");
});

it("accepts Clerk-style user ids with underscores", () => {
  expect(
    buildStoragePath({
      userId: "user_2abcXYZClerkId01",
      sessionId: "session-9",
      fileName: "form.pdf",
    }),
  ).toBe("user_2abcXYZClerkId01/session-9/form.pdf");
});

it("a_failed_session_removes_the_object", async () => {
  const bucket = fakeBucket();
  const path = await storeOriginal(bucket, {
    userId: "omera-user-1",
    sessionId: "session-9",
    fileName: "form.pdf",
    bytes: new Uint8Array([37, 80, 68, 70]),
    contentType: "application/pdf",
  });
  // Session creation failed after the upload: clean up the orphan object.
  await removeStoredObject(bucket, path);
  expect(bucket.removed).toEqual([path]);
});

it("uploads as application/pdf even when the caller passed octet-stream", async () => {
  const bucket = fakeBucket();
  await storeOriginal(bucket, {
    userId: "omera-user-1",
    sessionId: "session-9",
    fileName: "form.pdf",
    bytes: new Uint8Array([37, 80, 68, 70]),
    contentType: "application/octet-stream",
  });
  expect(bucket.contentTypes).toEqual([FORM_PDF_CONTENT_TYPE]);
  expect(bucket.bodies[0]).toBeInstanceOf(Blob);
  expect((bucket.bodies[0] as Blob).type).toBe(FORM_PDF_CONTENT_TYPE);
});

it("retries a transient storage error once", async () => {
  const bucket = fakeBucket({ failTimes: 1 });
  const path = await storeOriginal(bucket, {
    userId: "omera-user-1",
    sessionId: "session-9",
    fileName: "form.pdf",
    bytes: new Uint8Array([37, 80, 68, 70]),
  });
  expect(path).toBe("omera-user-1/session-9/form.pdf");
  expect(bucket.upload).toHaveBeenCalledTimes(2);
  expect(bucket.uploaded).toEqual([path]);
});

it("maps a 4 MB bucket rejection to FILE_TOO_LARGE", async () => {
  const bucket = fakeBucket({
    failTimes: 2,
    error: {
      message: "The object exceeded the maximum allowed size",
      statusCode: 413,
    },
  });
  await expect(
    storeOriginal(bucket, {
      userId: "omera-user-1",
      sessionId: "session-9",
      fileName: "form.pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    }),
  ).rejects.toMatchObject({
    code: "FILE_TOO_LARGE",
    detail: expect.stringMatching(/maximum allowed size/i),
  });
  expect(isStorageFileTooLarge({ status: 413, message: "too big" })).toBe(true);
});

it("keeps the supabase error message on a failed upload", async () => {
  const bucket = fakeBucket({
    failTimes: 2,
    error: { message: "Bucket not found", statusCode: "404" },
  });
  try {
    await storeOriginal(bucket, {
      userId: "omera-user-1",
      sessionId: "session-9",
      fileName: "form.pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    });
    throw new Error("expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(FormStorageError);
    expect(storageErrorDetail(error)).toBe("STORAGE_UPLOAD_FAILED");
    expect((error as FormStorageError).detail).toMatch(/Bucket not found/);
  }
});

it("a_client_path_is_rejected", () => {
  expect(() =>
    resolveStoragePath({
      userId: "omera-user-1",
      sessionId: "session-9",
      fileName: "form.pdf",
      clientPath: "../../evil/form.pdf",
    }),
  ).toThrow("CLIENT_PATH_REJECTED");
  expect(() =>
    resolveStoragePath({
      userId: "omera-user-1",
      sessionId: "session-9",
      fileName: "form.pdf",
      clientPath: "omera-user-1/session-9/form.pdf",
    }),
  ).toThrow("CLIENT_PATH_REJECTED");
});
