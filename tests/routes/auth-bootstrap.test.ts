import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({
  upsertOmeraUser: vi.fn(async () => "user-x"),
}));
import { NextResponse } from "next/server";
import { createAuthContext } from "@/lib/supabase/server";
import { POST } from "@/app/api/auth/bootstrap/route";

const ORIGIN = "https://omera.example";

beforeEach(() => {
  const env = process.env as Record<string, string | undefined>;
  env["NODE_ENV"] = "test";
  env["APP_ORIGIN"] = ORIGIN;
  env["SUPABASE_URL"] = "https://omera-example.supabase.co";
  env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key";
});

function post(body: unknown) {
  return new Request("https://omera.example/api/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

describe("auth bootstrap", () => {
  it("an_unverified_email_never_returns_an_existing_identity", async () => {
    const signInWithOtp = vi.fn(async () => ({ error: null }));
    vi.mocked(createAuthContext).mockResolvedValue({
      supabase: { auth: { signInWithOtp } },
      cookies: { getAll: () => [], setAll: () => undefined },
      applyCookies: (response: Response) => response,
    } as never);
    const response = (await POST(
      post({ email: "someone@example.com", displayName: "Someone" }),
    )) as unknown as NextResponse;
    expect(response.status).toBe(200);
    expect(response.cookies.get("omera_uid")).toBeUndefined();
    expect(await response.json()).toEqual({ ok: true });
  });
});
