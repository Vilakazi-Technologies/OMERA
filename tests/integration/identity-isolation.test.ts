import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createConversation,
  getConversation,
} from "@/lib/db/conversations";
import {
  createFormSession,
  deleteFormSession,
  getFormSession,
  updateFormSession,
} from "@/lib/db/form-sessions";
import {
  createTestIdentity,
  deleteTestIdentity,
  type TestIdentity,
} from "./identities";

// User A must never read or change user B's resources through the data
// layer that the routes use.

const FIELD = {
  id: "full_name",
  label: "Full name",
  type: "text" as const,
  required: true,
  prompt: "What is your full name?",
};

describe("identity isolation", () => {
  let userA: TestIdentity;
  let userB: TestIdentity;

  beforeAll(async () => {
    userA = await createTestIdentity("iso-a");
    userB = await createTestIdentity("iso-b");
  });

  afterAll(async () => {
    await deleteTestIdentity(userA);
    await deleteTestIdentity(userB);
  });

  it("user B cannot read user A's conversation", async () => {
    const conversation = await createConversation(
      userA.userId,
      "chat",
      "isolation conversation",
    );
    const foreign = await getConversation(conversation.id, userB.userId);
    expect(foreign).toBeNull();
  });

  it("user B cannot read user A's form session", async () => {
    const session = await createFormSession({
      userId: userA.userId,
      fileName: "isolation.pdf",
      fields: [FIELD],
      languageId: "eng",
    });
    const foreign = await getFormSession(session.id, userB.userId);
    expect(foreign).toBeNull();
  });

  it("user B cannot change user A's form session", async () => {
    const session = await createFormSession({
      userId: userA.userId,
      fileName: "isolation-patch.pdf",
      fields: [FIELD],
      languageId: "eng",
    });
    await expect(
      updateFormSession(session.id, userB.userId, {
        status: "completed",
        revision: 2,
      }),
    ).rejects.toThrow();
    const owned = await getFormSession(session.id, userA.userId);
    expect(owned?.status).not.toBe("completed");
  });

  it("user B cannot delete user A's form session", async () => {
    const session = await createFormSession({
      userId: userA.userId,
      fileName: "isolation-delete.pdf",
      fields: [FIELD],
      languageId: "eng",
    });
    const result = await deleteFormSession(session.id, userB.userId);
    expect(result.deleted).toBe(false);
    const stillOwned = await getFormSession(session.id, userA.userId);
    expect(stillOwned).not.toBeNull();
  });

  it("the service role alone never returns a cross-user row", async () => {
    const conversation = await createConversation(
      userA.userId,
      "chat",
      "service role probe",
    );
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("omera_conversations")
      .select("id")
      .eq("id", conversation.id)
      .eq("user_id", userB.userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
