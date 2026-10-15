import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { consumeQuota } from "@/lib/limits/consume-quota";
import {
  createTestIdentity,
  deleteTestIdentity,
  type TestIdentity,
} from "./identities";

// Concurrent requests must not push a user past the approved limit.

const LIMIT = 5;
const ATTEMPTS = 20;

describe("request limits", () => {
  let user: TestIdentity;

  beforeAll(async () => {
    user = await createTestIdentity("quota");
  });

  afterAll(async () => {
    await deleteTestIdentity(user);
  });

  it("concurrent requests cannot bypass the quota", async () => {
    const admin = getSupabaseAdmin();
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () =>
        consumeQuota(admin, user.userId, LIMIT),
      ),
    );
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(LIMIT);
    expect(results.filter((r) => !r.allowed)).toHaveLength(
      ATTEMPTS - LIMIT,
    );
  });

  it("a fresh window continues from the stored count", async () => {
    const admin = getSupabaseAdmin();
    const result = await consumeQuota(admin, user.userId, LIMIT);
    expect(result.allowed).toBe(false);
  });
});
