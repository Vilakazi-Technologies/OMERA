import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import { getConversation, insertMessage } from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    const { id } = await params;
    const conversation = await getConversation(id, identity.userId);
    if (!conversation) throw new ApiError("NOT_FOUND", 404);

    const body = (await req.json()) as {
      role: "user" | "assistant" | "system";
      content: string;
    };

    const message = await insertMessage(id, body.role, body.content);
    return auth.applyCookies(NextResponse.json({ message }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
