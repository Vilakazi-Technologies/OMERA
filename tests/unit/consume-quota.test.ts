import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { consumeQuota, type SupabaseAdminClient } from "@/lib/limits/consume-quota";

function adminReturning(data: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { rpc, admin: { rpc } as unknown as SupabaseAdminClient };
}

describe("consumeQuota", () => {
  it("returns the remaining count after exactly 1 RPC call", async () => {
    const { rpc, admin } = adminReturning([{ allowed: true, remaining: 4 }]);
    const result = await consumeQuota(admin, "user-1", 5);
    expect(result).toEqual({ allowed: true, remaining: 4 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("omera_consume_request_quota", {
      p_user_id: "user-1",
      p_limit: 5,
    });
  });

  it("returns QUOTA_EXCEEDED when the count reaches the limit", async () => {
    const { rpc, admin } = adminReturning([{ allowed: false, remaining: 0 }]);
    const result = await consumeQuota(admin, "user-1", 1);
    expect(result).toEqual({ allowed: false, code: "QUOTA_EXCEEDED" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("throws when the quota function fails", async () => {
    const { admin } = adminReturning(null, new Error("DB_DOWN"));
    await expect(consumeQuota(admin, "user-1", 5)).rejects.toThrow("DB_DOWN");
  });
});
