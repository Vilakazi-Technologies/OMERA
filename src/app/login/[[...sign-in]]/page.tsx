"use client";

import { SignIn } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AuthFlowNoticeBoundary } from "@/components/auth/auth-flow-notice-boundary";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";
import {
  CLERK_AFTER_AUTH_URL,
  CLERK_SIGN_UP_URL,
} from "@/lib/clerk-auth-config";

export default function SignInPage() {
  return (
    <AuthPageShell subtitle="Welcome back. Sign in to open your Omera workspace.">
      <RedirectIfSignedIn />
      <AuthFlowNoticeBoundary mode="sign-in" />
      <SignIn
        appearance={omeraClerkAppearance}
        routing="path"
        path="/login"
        signUpUrl={CLERK_SIGN_UP_URL}
        forceRedirectUrl={CLERK_AFTER_AUTH_URL}
        fallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
      />
    </AuthPageShell>
  );
}
