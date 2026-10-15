import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import { getConversation, updateConversationMeta } from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
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
    return auth.applyCookies(NextResponse.json({ conversation }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
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
    const existing = await getConversation(id, identity.userId);
    if (!existing) throw new ApiError("NOT_FOUND", 404);
    const body = (await req.json()) as { title?: string };
    if (body.title) await updateConversationMeta(id, { title: body.title });
    const conversation = await getConversation(id, identity.userId);
    return auth.applyCookies(NextResponse.json({ conversation }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
