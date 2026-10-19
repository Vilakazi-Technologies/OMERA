"use client";

import { SignIn } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthPageShell subtitle="Sign in or create an account to continue.">
      <RedirectIfSignedIn />
      <SignIn
        appearance={omeraClerkAppearance}
        routing="path"
        path="/login"
        signUpUrl="/sign-up"
        forceRedirectUrl="/chat"
        fallbackRedirectUrl="/chat"
      />
    </AuthPageShell>
  );
}
