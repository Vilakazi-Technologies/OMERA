import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
import { ApiError } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { GET } from "@/app/api/auth/session/route";

beforeEach(() => {
  vi.mocked(requireIdentity).mockReset();
});

describe("auth session", () => {
  it("an_unauthenticated_request_returns_401", async () => {
    vi.mocked(requireIdentity).mockRejectedValue(
      new ApiError("UNAUTHORIZED", 401),
    );
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("a_verified_session_returns_the_identity", async () => {
    vi.mocked(requireIdentity).mockResolvedValue({
      userId: "omera-1",
      authUserId: "user_clerk_1",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: "omera-1",
      persistence: "local",
    });
  });
});
