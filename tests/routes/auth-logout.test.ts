import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { POST } from "@/app/api/auth/logout/route";

function authContext(signOut: unknown) {
  return {
    supabase: { auth: { signOut } },
    cookies: { setAll: vi.fn() },
    applyCookies: (response: Response) => response,
  } as never;
}

it("a_sign_out_failure_does_not_report_success", async () => {
  vi.mocked(createAuthContext).mockResolvedValue(
    authContext(vi.fn(async () => ({ error: new Error("session invalid") }))),
  );
  const response = await POST();
  expect(response.status).toBe(502);
  expect(await response.json()).toStrictEqual({ error: "SIGN_OUT_FAILED" });
});

it("a_successful_sign_out_clears_the_identity_cookie", async () => {
  const setAll = vi.fn();
  vi.mocked(createAuthContext).mockResolvedValue({
    supabase: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
    cookies: { setAll },
    applyCookies: (response: Response) => response,
  } as never);
  const response = await POST();
  expect(response.status).toBe(200);
  expect(setAll).toHaveBeenCalledOnce();
  const cleared = setAll.mock.calls[0][0] as {
    name: string;
    options: { maxAge: number };
  }[];
  expect(cleared[0].name).toBe("omera_uid");
  expect(cleared[0].options.maxAge).toBe(0);
});
