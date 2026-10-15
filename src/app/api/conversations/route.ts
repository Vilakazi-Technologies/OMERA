import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import {
  createConversation,
  listConversations,
} from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ conversations: [], persistence: "local" });
  }
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    const conversations = await listConversations(identity.userId);
    return auth.applyCookies(
      NextResponse.json({ conversations, persistence: "supabase" }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    const body = (await req.json()) as {
      mode?: "chat" | "form";
      title?: string;
    };
    const conversation = await createConversation(
      identity.userId,
      body.mode ?? "chat",
      body.title,
    );
    return auth.applyCookies(NextResponse.json({ conversation }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
