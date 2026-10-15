import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { createAuthContext } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Legacy entry point, closed to identity issuance. An unverified email only
 * starts an OTP challenge and always receives the same neutral response with
 * no identity cookie. Verified clients use `/api/auth/verify` + `/api/auth/session`.
 */
export async function POST(request: Request) {
  try {
    requireRequestOrigin(request);
    const body = (await readJsonBody(request)) as { email?: unknown };
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    const auth = await createAuthContext();
    await auth.supabase.auth.signInWithOtp({ email });
    return auth.applyCookies(
      NextResponse.json({ ok: true }, { headers: NO_STORE }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
