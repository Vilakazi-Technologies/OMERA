"use client";

import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <AuthPageShell subtitle="Create your Omera account.">
      <RedirectIfSignedIn />
      <SignUp
        appearance={omeraClerkAppearance}
        routing="path"
        path="/sign-up"
        signInUrl="/login"
        forceRedirectUrl="/chat"
        fallbackRedirectUrl="/chat"
      />
    </AuthPageShell>
  );
}
