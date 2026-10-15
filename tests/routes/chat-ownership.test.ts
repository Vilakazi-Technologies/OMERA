import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/db/conversations", () => ({
  getConversation: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseConfigured: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/require-identity";
import { getConversation } from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { GET } from "@/app/api/conversations/[id]/route";

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(createAuthContext).mockResolvedValue({
    supabase: {},
    cookies: { getAll: () => [], setAll: () => undefined },
    applyCookies: (response: Response) => response,
  } as never);
  // The conversation belongs to user A; the scoped lookup for user B finds
  // nothing, so the route must answer 404 instead of leaking existence.
  vi.mocked(requireIdentity).mockResolvedValue({
    userId: "omera-user-b",
    authUserId: "auth-b",
  });
  vi.mocked(getConversation).mockImplementation(async (id, userId) => {
    if (id === CONVERSATION_ID && userId === "omera-user-a") {
      return { id } as never;
    }
    return null;
  });
});

describe("conversation ownership", () => {
  it("another_users_conversation_returns_404", async () => {
    const response = await GET(
      new Request(`https://omera.example/api/conversations/${CONVERSATION_ID}`),
      { params: Promise.resolve({ id: CONVERSATION_ID }) },
    );
    expect(response.status).toBe(404);
    expect(vi.mocked(getConversation)).toHaveBeenCalledWith(
      CONVERSATION_ID,
      "omera-user-b",
    );
  });
});
