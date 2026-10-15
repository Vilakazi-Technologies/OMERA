import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/users", () => ({
  findOmeraUserByAuthId: vi.fn(),
  createOmeraUserForAuthId: vi.fn(),
}));
import {
  findOmeraUserByAuthId,
  createOmeraUserForAuthId,
} from "@/lib/db/users";
import { requireIdentity } from "@/lib/auth/require-identity";
import type { AuthContext } from "@/lib/supabase/server";

function contextWith(user: unknown, error: unknown = null): AuthContext {
  const getUser = vi.fn(async () => ({ data: { user }, error }));
  return {
    supabase: { auth: { getUser } },
    cookies: { getAll: () => [], setAll: () => undefined },
    applyCookies: (response: Response) => response,
  } as unknown as AuthContext;
}

beforeEach(() => {
  vi.mocked(findOmeraUserByAuthId).mockResolvedValue(null);
  vi.mocked(createOmeraUserForAuthId).mockResolvedValue("omera-new");
});

describe("requireIdentity", () => {
  it("rejects a forged cookie with 401", async () => {
    const context = contextWith(null, new Error("invalid token"));
    await expect(requireIdentity(context)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(findOmeraUserByAuthId).not.toHaveBeenCalled();
  });

  it("maps a verified user through auth_user_id", async () => {
    vi.mocked(findOmeraUserByAuthId).mockResolvedValue("omera-1");
    const identity = await requireIdentity(
      contextWith({ id: "auth-1", user_metadata: {} }),
    );
    expect(identity).toEqual({ userId: "omera-1", authUserId: "auth-1" });
    expect(findOmeraUserByAuthId).toHaveBeenCalledWith("auth-1");
    expect(createOmeraUserForAuthId).not.toHaveBeenCalled();
  });

  it("creates a row when a verified identity has none yet", async () => {
    const identity = await requireIdentity(
      contextWith({ id: "auth-2", user_metadata: {} }),
    );
    expect(identity).toEqual({ userId: "omera-new", authUserId: "auth-2" });
    expect(createOmeraUserForAuthId).toHaveBeenCalledWith(
      "auth-2",
      expect.any(String),
    );
  });
});
