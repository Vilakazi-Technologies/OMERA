import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { POST } from "@/app/api/auth/verify/route";

const ORIGIN = "https://omera.example";

beforeEach(() => {
  const env = process.env as Record<string, string | undefined>;
  env["NODE_ENV"] = "test";
  env["APP_ORIGIN"] = ORIGIN;
});

function authWith(overrides: {
  verifyOtp?: unknown;
  signInWithOtp?: unknown;
} = {}) {
  const verifyOtp = vi.fn(async () => overrides.verifyOtp ?? { error: null });
  const signInWithOtp = vi.fn(
    async () => overrides.signInWithOtp ?? { error: null },
  );
  const applied: Response[] = [];
  const auth = {
    supabase: { auth: { verifyOtp, signInWithOtp } },
    cookies: { getAll: () => [], setAll: () => undefined },
    applyCookies: (response: Response) => {
      applied.push(response);
      return response;
    },
  };
  vi.mocked(createAuthContext).mockResolvedValue(auth as never);
  return { verifyOtp, signInWithOtp, applied };
}

function post(body: unknown, origin: string = ORIGIN) {
  return new Request("https://omera.example/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

describe("auth verify", () => {
  it("an_expired_otp_returns_a_neutral_failure", async () => {
    authWith({ verifyOtp: { error: new Error("Token has expired") } });
    const response = await POST(post({ email: "a@b.co", token: "123456" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "INVALID_CODE" });
  });

  it("an_invalid_otp_returns_a_neutral_failure", async () => {
    authWith({ verifyOtp: { error: new Error("wrong code") } });
    const response = await POST(post({ email: "a@b.co", token: "000000" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "INVALID_CODE" });
  });

  it("a_valid_otp_returns_session_cookies", async () => {
    const { applied } = authWith();
    const response = await POST(post({ email: "a@b.co", token: "123456" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(applied).toHaveLength(1);
  });

  it("otp_start_does_not_reveal_account_existence", async () => {
    const { signInWithOtp } = authWith({
      signInWithOtp: { error: new Error("synthetic provider failure") },
    });
    const response = await POST(post({ email: "nobody@nowhere.co" }));
    expect(signInWithOtp).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
