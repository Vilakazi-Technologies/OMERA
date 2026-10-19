import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseConfigured: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({
  findOmeraUserByAuthId: vi.fn(),
  createOmeraUserForAuthId: vi.fn(),
}));
import { auth, currentUser } from "@clerk/nextjs/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  findOmeraUserByAuthId,
  createOmeraUserForAuthId,
} from "@/lib/db/users";
import { requireIdentity } from "@/lib/auth/require-identity";

beforeEach(() => {
  vi.mocked(findOmeraUserByAuthId).mockResolvedValue(null);
  vi.mocked(createOmeraUserForAuthId).mockResolvedValue("omera-new");
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(currentUser).mockResolvedValue({
    fullName: "Test User",
    primaryEmailAddress: { emailAddress: "test@example.com" },
  } as never);
});

describe("requireIdentity", () => {
  it("rejects when Clerk has no session", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    await expect(requireIdentity()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(findOmeraUserByAuthId).not.toHaveBeenCalled();
  });

  it("uses clerk id directly when database is not configured", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(auth).mockResolvedValue({ userId: "user_clerk_1" } as never);
    const identity = await requireIdentity();
    expect(identity).toEqual({
      userId: "user_clerk_1",
      authUserId: "user_clerk_1",
    });
    expect(findOmeraUserByAuthId).not.toHaveBeenCalled();
  });

  it("maps a verified user through auth_user_id when database is configured", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_clerk_1" } as never);
    vi.mocked(findOmeraUserByAuthId).mockResolvedValue("omera-1");
    const identity = await requireIdentity();
    expect(identity).toEqual({
      userId: "omera-1",
      authUserId: "user_clerk_1",
    });
  });

  it("creates a row when a verified identity has none yet", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_clerk_2" } as never);
    const identity = await requireIdentity();
    expect(identity).toEqual({
      userId: "omera-new",
      authUserId: "user_clerk_2",
    });
    expect(createOmeraUserForAuthId).toHaveBeenCalledWith(
      "user_clerk_2",
      "Test User",
      "test@example.com",
    );
  });

  it("falls back to clerk id when database provisioning fails", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_clerk_9" } as never);
    vi.mocked(findOmeraUserByAuthId).mockRejectedValue(
      new Error("invalid input syntax for type uuid"),
    );
    const identity = await requireIdentity();
    expect(identity).toEqual({
      userId: "user_clerk_9",
      authUserId: "user_clerk_9",
    });
  });
});
