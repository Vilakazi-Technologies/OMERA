import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createFormSession,
  deleteFormSession,
  getFormSession,
  updateFormSession,
} from "@/lib/db/form-sessions";
import {
  FORMS_BUCKET,
  buildStoragePath,
  removeStoredObject,
  storeOriginal,
} from "@/lib/forms/storage";
import {
  createTestIdentity,
  deleteTestIdentity,
  type TestIdentity,
} from "./identities";

// Deletion removes the intended database row and its private object.
// Another user's rows and objects stay in place.

describe("form deletion", () => {
  let userA: TestIdentity;
  let userB: TestIdentity;
  let sessionAId: string;
  let sessionBId: string;
  let pathA: string;
  const bytes = new TextEncoder().encode("%PDF-1.4 synthetic delete fixture");

  beforeAll(async () => {
    userA = await createTestIdentity("delete-a");
    userB = await createTestIdentity("delete-b");
    const sessionA = await createFormSession({
      userId: userA.userId,
      fileName: "delete-a.pdf",
      fields: [
        {
          id: "full_name",
          label: "Full name",
          type: "text",
          required: true,
          prompt: "What is your full name?",
        },
      ],
      languageId: "eng",
    });
    sessionAId = sessionA.id;
    pathA = buildStoragePath({
      userId: userA.userId,
      sessionId: sessionAId,
      fileName: "delete-a.pdf",
    });
    const admin = getSupabaseAdmin();
    await storeOriginal(admin.storage.from(FORMS_BUCKET), {
      userId: userA.userId,
      sessionId: sessionAId,
      fileName: "delete-a.pdf",
      bytes,
      contentType: "application/pdf",
    });
    // The row must reference the uploaded object: deletion reports the
    // stored path, and export resolves the original bytes through it.
    await updateFormSession(sessionAId, userA.userId, {
      storagePath: pathA,
      documentSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const sessionB = await createFormSession({
      userId: userB.userId,
      fileName: "delete-b.pdf",
      fields: [
        {
          id: "full_name",
          label: "Full name",
          type: "text",
          required: true,
          prompt: "What is your full name?",
        },
      ],
      languageId: "eng",
    });
    sessionBId = sessionB.id;
  });

  afterAll(async () => {
    await deleteTestIdentity(userA);
    await deleteTestIdentity(userB);
  });

  it("an owner delete removes the row and reports the object path", async () => {
    const result = await deleteFormSession(sessionAId, userA.userId);
    expect(result.deleted).toBe(true);
    expect(result.storagePath).toBe(pathA);
    expect(await getFormSession(sessionAId, userA.userId)).toBeNull();
  });

  it("the private object is removed after the row delete", async () => {
    const admin = getSupabaseAdmin();
    await removeStoredObject(admin.storage.from(FORMS_BUCKET), pathA);
    const { error } = await admin.storage
      .from(FORMS_BUCKET)
      .download(pathA);
    expect(error).toBeTruthy();
  });

  it("another user's session survives the delete", async () => {
    const session = await getFormSession(sessionBId, userB.userId);
    expect(session).not.toBeNull();
    expect(session?.id).toBe(sessionBId);
  });
});
