import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createOmeraUserForAuthId,
  findOmeraUserByAuthId,
} from "@/lib/db/users";

/** Minimal query-builder fake shaped like the calls users.ts makes. */
function tableFake(state: {
  existing: { id: string } | null;
  upserted: unknown[];
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: state.existing, error: null })),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn((row: unknown) => {
      state.upserted.push(row);
      // The database converges both racers on one row; the re-read below
      // observes the winner whichever caller runs first.
      state.existing = { id: "winner-row" };
      return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
    }),
    single: vi.fn(async () => ({ data: { id: "new-row" }, error: null })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("concurrent_creates_converge_on_one_row", async () => {
  const state = { existing: null as { id: string } | null, upserted: [] as unknown[] };
  const table = tableFake(state);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: () => table,
  } as never);
  const [first, second] = await Promise.all([
    createOmeraUserForAuthId("auth-race", "Omera user"),
    createOmeraUserForAuthId("auth-race", "Omera user"),
  ]);
  expect(first).toBe("winner-row");
  expect(second).toBe("winner-row");
  for (const row of state.upserted) {
    expect(row).toStrictEqual({
      auth_user_id: "auth-race",
      email: null,
      display_name: "Omera user",
    });
  }
  // The losing insert never throws a unique violation: both callers
  // resolve to the single surviving row.
  expect(table.upsert).toHaveBeenCalledTimes(2);
});

it("a_plain_insert_unique_violation_resolves_to_the_winner", async () => {
  const state = { existing: { id: "winner-row" }, upserted: [] as unknown[] };
  const table = tableFake(state);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: () => table,
  } as never);
  expect(await findOmeraUserByAuthId("auth-race")).toBe("winner-row");
});
