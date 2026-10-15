import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import { listFormSessions } from "@/lib/db/form-sessions";
import { toClientSession } from "@/app/api/forms/sessions/[id]/route";

export async function GET() {
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    const sessions = await listFormSessions(identity.userId);
    return auth.applyCookies(
      NextResponse.json({ sessions: sessions.map(toClientSession) }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
