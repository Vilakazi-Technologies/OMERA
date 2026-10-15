import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import { OMERA_USER_COOKIE } from "@/lib/auth/session";
import { createAuthContext } from "@/lib/supabase/server";

export async function POST() {
  try {
    const auth = await createAuthContext();
    await auth.supabase.auth.signOut();
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
