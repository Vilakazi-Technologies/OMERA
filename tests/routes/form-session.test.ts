import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/auth/request-origin", () => ({
  requireRequestOrigin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/db/form-sessions", () => ({
  applyAnswerPatch: vi.fn(),
  deleteFormSession: vi.fn(),
  getFormSession: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/require-identity";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  applyAnswerPatch,
  deleteFormSession,
  getFormSession,
  type FormSessionRecord,
} from "@/lib/db/form-sessions";
import { DELETE, GET, PATCH } from "@/app/api/forms/sessions/[id]/route";

const SESSION_ID = "session-1";

function stored(): FormSessionRecord {
  return {
    id: SESSION_ID,
    fileName: "form.pdf",
    storagePath: "omera-user-1/session-1/form.pdf",
    fields: [
      {
        id: "full_name",
        label: "Full name",
        type: "text",
        required: true,
        prompt: "What is your full name?",
        kind: "text",
      },
      {
        id: "method",
        label: "Contact method",
        type: "text",
        required: false,
        prompt: "How should we contact you?",
        kind: "choice",
        options: ["Email", "Phone"],
      },
      {
        id: "permission",
        label: "Permission",
        type: "text",
        required: false,
        prompt: "May we contact you?",
        kind: "checkbox",
      },
    ],
    currentIndex: 0,
    languageId: "eng",
    documentSha256: "abc",
    documentKind: "acroform",
    revision: 3,
    status: "in_progress",
  };
}

function patchRequest(body: unknown): Request {
  return new Request(`https://omera.example/api/forms/sessions/${SESSION_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(createAuthContext).mockResolvedValue({
    applyCookies: (response: Response) => response,
  } as never);
  vi.mocked(requireIdentity).mockResolvedValue({
    userId: "omera-user-1",
    authUserId: "auth-1",
  } as never);
  vi.mocked(requireRequestOrigin).mockReturnValue(undefined);
  vi.mocked(getFormSession).mockResolvedValue(stored());
  vi.mocked(applyAnswerPatch).mockImplementation(
    async (_id, _user, patch) =>
      ({ ...stored(), fields: patch.fields, revision: patch.revision }) as never,
  );
});

it("an_unknown_answer_id_returns_400", async () => {
  const response = await PATCH(
    patchRequest({ answers: { invented: "x" }, revision: 3 }),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toStrictEqual({ error: "UNKNOWN_ANSWER_ID" });
  expect(vi.mocked(applyAnswerPatch)).not.toHaveBeenCalled();
});

it("a_missing_required_value_returns_400", async () => {
  const response = await PATCH(
    patchRequest({ answers: { method: "Email" }, revision: 3 }),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toStrictEqual({
    error: "MISSING_REQUIRED_VALUE",
  });
  expect(vi.mocked(applyAnswerPatch)).not.toHaveBeenCalled();
});

it("an_invalid_choice_returns_400", async () => {
  const response = await PATCH(
    patchRequest({
      answers: { full_name: "Thendo", method: "Carrier pigeon" },
      revision: 3,
    }),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toStrictEqual({ error: "INVALID_CHOICE" });
  expect(vi.mocked(applyAnswerPatch)).not.toHaveBeenCalled();
});

it("a_stale_revision_returns_409", async () => {
  const response = await PATCH(
    patchRequest({ answers: { full_name: "Thendo" }, revision: 2 }),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toStrictEqual({ error: "REVISION_CONFLICT" });
  expect(vi.mocked(applyAnswerPatch)).not.toHaveBeenCalled();
});

it("another_users_session_returns_404", async () => {
  // The scoped lookup for another user finds nothing: existence is not leaked.
  vi.mocked(getFormSession).mockResolvedValueOnce(null);
  const response = await GET(
    new Request(`https://omera.example/api/forms/sessions/${SESSION_ID}`),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(404);
  expect(vi.mocked(getFormSession)).toHaveBeenCalledWith(
    SESSION_ID,
    "omera-user-1",
  );
});

it("a_deletion_removes_the_owned_objects", async () => {
  const removed: string[][] = [];
  let attempts = 0;
  vi.mocked(deleteFormSession).mockResolvedValueOnce({
    deleted: true,
    storagePath: "omera-user-1/session-1/form.pdf",
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          attempts += 1;
          // A transient object failure is retried before giving up.
          return attempts === 1 ? { error: new Error("flaky") } : { error: null };
        },
      }),
    },
  } as never);
  const response = await DELETE(
    new Request(`https://omera.example/api/forms/sessions/${SESSION_ID}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: SESSION_ID }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toStrictEqual({ deleted: true });
  expect(removed).toEqual([
    ["omera-user-1/session-1/form.pdf"],
    ["omera-user-1/session-1/form.pdf"],
  ]);
});
