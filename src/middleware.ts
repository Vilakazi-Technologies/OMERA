import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/auth(.*)",
  "/privacy",
  "/terms",
  "/api/health",
  "/api/capabilities",
  "/api/ai/models",
  "/api/store/complete-json",
  "/api/store/complete-vision-json",
]);

const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  // API routes authenticate in-handler (`requireIdentity`) so a missing Clerk
  // cookie returns JSON 401 — not Clerk's HTML 404 protect-rewrite, which the
  // form page previously showed as a generic "could not read this PDF" error.
  if (isApiRoute(request)) return NextResponse.next();

  const { userId } = await auth();
  if (!userId) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect_url", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
