import { NextResponse } from "next/server";
import { getUserIdFromCookies } from "@/lib/auth/session";
import { getConversation, insertMessage } from "@/lib/db/conversations";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;
  const conversation = await getConversation(id, userId);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    role: "user" | "assistant" | "system";
    content: string;
  };

  const message = await insertMessage(id, body.role, body.content);
  return NextResponse.json({ message });
}
