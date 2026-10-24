import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/http/api-error";
import { requireIdentity } from "@/lib/auth/require-identity";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
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
    const identity = await requireIdentity();
    const conversations = await listConversations(identity.userId);
    return NextResponse.json({ conversations, persistence: "supabase" });
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
    const identity = await requireIdentity();
    requireRequestOrigin(req);
    const body = (await req.json()) as {
      mode?: "chat" | "form";
      title?: string;
    };
    const conversation = await createConversation(
      identity.userId,
      body.mode ?? "chat",
      body.title,
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
