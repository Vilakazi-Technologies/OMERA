import { NextResponse, type NextRequest } from "next/server";

/** Email links sometimes land on / or /login with token_hash — forward to /auth/callback. */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (code || (tokenHash && type)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth/callback";
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/chat", "/form"],
};
