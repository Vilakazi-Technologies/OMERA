import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateFormSession } from "@/lib/db/form-sessions";

const ROW = {
  id: "session-1",
  file_name: "form.pdf",
  storage_path: "u/s/form.pdf",
  fields_json: [{ id: "full_name" }],
  current_index: 2,
  language_id: "eng",
  document_sha256: "abc",
  document_kind: "acroform",
  revision: 4,
  status: "review",
};

function adminFake(captured: { update: unknown[] }) {
  return {
    from: () => ({
      update: (patch: unknown) => {
        captured.update.push(patch);
        return {
          eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: ROW, error: null }) }) }) }),
        };
      },
    }),
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("a_status_only_completion_update_never_touches_stored_answers", async () => {
  const captured: { update: unknown[] } = { update: [] };
  vi.mocked(getSupabaseAdmin).mockReturnValue(adminFake(captured));
  const record = await updateFormSession("session-1", "omera-user-1", {
    status: "completed",
  });
  expect(captured.update).toHaveLength(1);
  const sent = captured.update[0] as Record<string, unknown>;
  expect(sent).not.toHaveProperty("fields_json");
  expect(sent["status"]).toBe("completed");
  expect(record.fields).toStrictEqual([{ id: "full_name" }]);
  expect(record.status).toBe("review");
});

it("a_storage_backfill_update_sets_path_and_digest_only", async () => {
  const captured: { update: unknown[] } = { update: [] };
  vi.mocked(getSupabaseAdmin).mockReturnValue(adminFake(captured));
  await updateFormSession("session-1", "omera-user-1", {
    storagePath: "u/s/form.pdf",
    documentSha256: "def",
  });
  const sent = captured.update[0] as Record<string, unknown>;
  expect(sent["storage_path"]).toBe("u/s/form.pdf");
  expect(sent["document_sha256"]).toBe("def");
  expect(sent).not.toHaveProperty("fields_json");
  expect(sent).not.toHaveProperty("current_index");
});
