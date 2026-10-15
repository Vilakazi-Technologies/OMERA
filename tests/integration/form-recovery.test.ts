import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyAnswerPatch,
  createFormSession,
  getFormSession,
  listFormSessions,
} from "@/lib/db/form-sessions";
import {
  createTestIdentity,
  deleteTestIdentity,
  type TestIdentity,
} from "./identities";

// A page refresh must restore the owner's answers and status from the
// server. Local state is never the source of truth.

const FIELD = {
  id: "full_name",
  label: "Full name",
  type: "text" as const,
  required: true,
  prompt: "What is your full name?",
};

describe("form recovery", () => {
  let userA: TestIdentity;
  let userB: TestIdentity;
  let sessionId: string;

  beforeAll(async () => {
    userA = await createTestIdentity("recovery-a");
    userB = await createTestIdentity("recovery-b");
    const session = await createFormSession({
      userId: userA.userId,
      fileName: "recovery.pdf",
      fields: [FIELD],
      languageId: "zul",
    });
    sessionId = session.id;
    await applyAnswerPatch(sessionId, userA.userId, {
      fields: [{ ...FIELD, value: "Thandi Mokoena" }],
      currentIndex: 1,
      status: "review",
      revision: 2,
    });
  });

  afterAll(async () => {
    await deleteTestIdentity(userA);
    await deleteTestIdentity(userB);
  });

  it("a refresh restores the saved answers and status", async () => {
    const session = await getFormSession(sessionId, userA.userId);
    expect(session).not.toBeNull();
    expect(session?.fields[0]?.value).toBe("Thandi Mokoena");
    expect(session?.status).toBe("review");
    expect(session?.revision).toBe(2);
    expect(session?.languageId).toBe("zul");
  });

  it("the owned session list contains the recovered session", async () => {
    const sessions = await listFormSessions(userA.userId);
    expect(sessions.map((s) => s.id)).toContain(sessionId);
  });

  it("another user's list never contains the session", async () => {
    const sessions = await listFormSessions(userB.userId);
    expect(sessions.map((s) => s.id)).not.toContain(sessionId);
  });
});
