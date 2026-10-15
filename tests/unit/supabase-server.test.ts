import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthContext } from "@/lib/supabase/server";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://omera-example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

function mockJar() {
  const store = new Map<string, string>([["existing", "1"]]);
  return {
    getAll: vi.fn(() => [...store.entries()].map(([name, value]) => ({ name, value }))),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
  };
}

describe("createAuthContext", () => {
  it("writes every pending cookie update without touching cache headers", async () => {
    vi.mocked(cookies).mockResolvedValue(mockJar() as never);
    const context = await createAuthContext();
    context.cookies.setAll([
      { name: "sb-access", value: "a" },
      { name: "sb-refresh", value: "b" },
    ]);
    const response = context.applyCookies(
      NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } },
      ),
    ) as unknown as NextResponse;
    expect(response.cookies.get("sb-access")?.value).toBe("a");
    expect(response.cookies.get("sb-refresh")?.value).toBe("b");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses to build a client without Supabase configuration", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    await expect(createAuthContext()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });
});
