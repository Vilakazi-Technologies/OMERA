import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { OMERA_USER_COOKIE } from "@/lib/auth/session";
import { createAuthContext } from "@/lib/supabase/server";

export async function POST() {
  try {
    const auth = await createAuthContext();
    const { error: signOutError } = await auth.supabase.auth.signOut();
    // A failed provider sign-out must stay a failure: clearing cookies
    // and reporting success would leave a live session behind a lie.
    if (signOutError) throw new ApiError("SIGN_OUT_FAILED", 502);
    auth.cookies.setAll([
      {
        name: OMERA_USER_COOKIE,
        value: "",
        options: {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
        },
      },
    ]);
    return auth.applyCookies(
      NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } },
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
