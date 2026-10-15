import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({
  findOmeraUserByAuthId: vi.fn(),
  createOmeraUserForAuthId: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { findOmeraUserByAuthId } from "@/lib/db/users";
import { GET } from "@/app/api/auth/session/route";

function authFor(user: unknown, error: unknown = null) {
  const auth = {
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user }, error })) },
    },
    cookies: { getAll: () => [], setAll: () => undefined },
    applyCookies: (response: Response) => response,
  };
  vi.mocked(createAuthContext).mockResolvedValue(auth as never);
}

beforeEach(() => {
  vi.mocked(findOmeraUserByAuthId).mockResolvedValue(null);
});

describe("auth session", () => {
  it("an_arbitrary_uuid_cookie_returns_401", async () => {
    // A forged omera_uid cookie reaches no provider session.
    authFor(null, new Error("invalid token"));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("a_verified_session_returns_the_identity", async () => {
    vi.mocked(findOmeraUserByAuthId).mockResolvedValue("omera-1");
    authFor({ id: "auth-1", user_metadata: {} });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "omera-1" });
    expect(findOmeraUserByAuthId).toHaveBeenCalledWith("auth-1");
  });
});
