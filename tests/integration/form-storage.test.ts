import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
import { integrationTarget } from "./setup";

// A private form object must deny every unauthenticated read.

describe("form storage privacy", () => {
  let user: TestIdentity;
  let path: string;
  const canary = "SYNTHETIC_OMERA_STORAGE_CANARY";

  beforeAll(async () => {
    user = await createTestIdentity("storage");
    const admin = getSupabaseAdmin();
    path = buildStoragePath({
      userId: user.userId,
      sessionId: "00000000-0000-0000-0000-000000000001",
      fileName: "privacy.pdf",
    });
    await storeOriginal(admin.storage.from(FORMS_BUCKET), {
      userId: user.userId,
      sessionId: "00000000-0000-0000-0000-000000000001",
      fileName: "privacy.pdf",
      bytes: new TextEncoder().encode(canary),
      contentType: "application/pdf",
    });
  });

  afterAll(async () => {
    const admin = getSupabaseAdmin();
    await removeStoredObject(admin.storage.from(FORMS_BUCKET), path);
    await deleteTestIdentity(user);
  });

  it("an unauthenticated read of the object fails", async () => {
    const admin = getSupabaseAdmin();
    const { data } = admin.storage.from(FORMS_BUCKET).getPublicUrl(path);
    const response = await fetch(data.publicUrl);
    expect(response.status).not.toBe(200);
    const body = await response.text();
    expect(body).not.toContain(canary);
  });

  it("the raw storage API denies an unauthenticated request", async () => {
    const response = await fetch(
      `${integrationTarget}`.replace(/\/$/, "") +
        `/storage/v1/object/${FORMS_BUCKET}/${path}`,
    );
    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(canary);
  });
});
