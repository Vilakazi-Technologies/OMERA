import { expect, it, vi } from "vitest";
import {
  buildStoragePath,
  removeStoredObject,
  resolveStoragePath,
  storeOriginal,
  type FormsBucket,
} from "@/lib/forms/storage";

function fakeBucket(): FormsBucket & { uploaded: string[]; removed: string[] } {
  const state = {
    uploaded: [] as string[],
    removed: [] as string[],
  };
  return {
    ...state,
    uploaded: state.uploaded,
    removed: state.removed,
    upload: vi.fn(async (path: string) => {
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
