import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";

export async function GET() {
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    return auth.applyCookies(
      NextResponse.json(
        { userId: identity.userId },
        { headers: { "Cache-Control": "private, no-store" } },
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
