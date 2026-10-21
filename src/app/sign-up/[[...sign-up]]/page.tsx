"use client";

import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AuthFlowNoticeBoundary } from "@/components/auth/auth-flow-notice-boundary";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";
import {
  CLERK_AFTER_AUTH_URL,
  CLERK_SIGN_IN_URL,
} from "@/lib/clerk-auth-config";

export default function SignUpPage() {
  return (
    <AuthPageShell subtitle="Create your account. We will email you a quick confirmation link.">
      <RedirectIfSignedIn />
      <AuthFlowNoticeBoundary mode="sign-up" />
      <SignUp
        appearance={omeraClerkAppearance}
        routing="path"
        path="/sign-up"
        signInUrl={CLERK_SIGN_IN_URL}
        forceRedirectUrl={CLERK_AFTER_AUTH_URL}
        fallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
      />
    </AuthPageShell>
  );
}
