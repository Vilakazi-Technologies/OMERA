import { NextResponse } from "next/server";
import { getUserIdFromCookies } from "@/lib/auth/session";
import { getFormSession, updateFormSession } from "@/lib/db/form-sessions";
import type { FormField } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;
  const session = await getFormSession(id, userId);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function PATCH(req: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json()) as {
    fields?: FormField[];
    currentIndex?: number;
    status?: "in_progress" | "completed";
  };

  await updateFormSession(id, userId, body);
  const session = await getFormSession(id, userId);
  return NextResponse.json({ session });
}
