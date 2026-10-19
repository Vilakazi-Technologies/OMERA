import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import {
  isClerkUserId,
  requireIdentity,
} from "@/lib/auth/require-identity";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const identity = await requireIdentity();
    const cloudReady =
      isSupabaseConfigured() && !isClerkUserId(identity.userId);
    return NextResponse.json(
      {
        userId: identity.userId,
        persistence: cloudReady ? "supabase" : "local",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
