import { NextResponse } from "next/server";
import { OMERA_USER_COOKIE } from "@/lib/auth/session";
import { upsertOmeraUser } from "@/lib/db/users";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email?: string;
    displayName?: string;
  };

  const displayName = body.displayName?.trim() || "Omera user";
  const email = body.email?.trim() || null;

  if (!isSupabaseConfigured()) {
    const res = NextResponse.json({
      userId: null,
      displayName,
      persistence: "local",
    });
    return res;
  }

  const userId = await upsertOmeraUser(displayName, email);
  const res = NextResponse.json({
    userId,
    displayName,
    persistence: "supabase",
  });

  res.cookies.set(OMERA_USER_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });

  return res;
}
