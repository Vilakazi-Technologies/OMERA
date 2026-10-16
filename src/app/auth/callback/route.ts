import { NextResponse } from "next/server";
import { createAuthContext } from "@/lib/supabase/server";

function appOrigin(): string {
  const raw = process.env.APP_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

/** Handles Supabase magic-link clicks from the sign-in email. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chat";
  const origin = appOrigin();
  const login = `${origin}/login`;

  if (!code) {
    return NextResponse.redirect(`${login}?error=missing_code`);
  }

  const auth = await createAuthContext();
  const { error } = await auth.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${login}?error=auth_callback`);
  }

  const path = next.startsWith("/") ? next : `/${next}`;
  return auth.applyCookies(NextResponse.redirect(`${origin}${path}`));
}
