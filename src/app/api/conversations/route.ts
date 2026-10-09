import { NextResponse } from "next/server";
import { getUserIdFromCookies } from "@/lib/auth/session";
import {
  createConversation,
  listConversations,
} from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ conversations: [], persistence: "local" });
  }
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const conversations = await listConversations(userId);
  return NextResponse.json({ conversations, persistence: "supabase" });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = (await req.json()) as { mode?: "chat" | "form"; title?: string };
  const conversation = await createConversation(
    userId,
    body.mode ?? "chat",
    body.title,
  );
  return NextResponse.json({ conversation });
}
