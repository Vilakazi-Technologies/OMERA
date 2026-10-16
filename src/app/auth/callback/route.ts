import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthContext } from "@/lib/supabase/server";

function appOrigin(): string {
  const raw = process.env.APP_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Handles Supabase email links (PKCE code or token_hash) after sign-in email. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/chat";
  const origin = appOrigin();
  const login = `${origin}/login`;

  const auth = await createAuthContext();

  if (code) {
    const { error } = await auth.supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${login}?error=auth_callback`);
    }
    const path = next.startsWith("/") ? next : `/${next}`;
    return auth.applyCookies(NextResponse.redirect(`${origin}${path}`));
  }

  if (tokenHash && typeParam && OTP_TYPES.has(typeParam as EmailOtpType)) {
    const { error } = await auth.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(`${login}?error=auth_callback`);
    }
    const path = next.startsWith("/") ? next : `/${next}`;
    return auth.applyCookies(NextResponse.redirect(`${origin}${path}`));
  }

  return NextResponse.redirect(`${login}?error=missing_code`);
}
