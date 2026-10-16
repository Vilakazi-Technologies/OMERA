import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { createAuthContext } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

function validEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function POST(request: Request) {
  try {
    requireRequestOrigin(request);
    const body = (await readJsonBody(request)) as {
      email?: unknown;
      token?: unknown;
    };
    const email = validEmail(body.email);
    if (!email) throw new ApiError("INVALID_REQUEST", 400);

    const auth = await createAuthContext();
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (token) {
      const types = ["email", "signup", "magiclink"] as const;
      let verified = false;
      for (const type of types) {
        const { error } = await auth.supabase.auth.verifyOtp({
          email,
          token,
          type,
        });
        if (!error) {
          verified = true;
          break;
        }
      }
      if (!verified) throw new ApiError("INVALID_CODE", 401);
      return auth.applyCookies(
        NextResponse.json({ ok: true }, { headers: NO_STORE }),
      );
    }

    const origin = (process.env.APP_ORIGIN ?? "").replace(/\/$/, "");
    // OTP start is neutral by design: never reveal whether the email exists.
    // First-time users are created automatically (no separate sign-up page).
    const { error } = await auth.supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("redirect") ||
        message.includes("email") ||
        message.includes("smtp") ||
        message.includes("rate")
      ) {
        throw new ApiError("EMAIL_DELIVERY_FAILED", 503);
      }
    }
    return auth.applyCookies(
      NextResponse.json({ ok: true, method: "email" }, { headers: NO_STORE }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
