"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AppProvider } from "@/context/app-provider";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";
import {
  CLERK_AFTER_AUTH_URL,
  CLERK_SIGN_IN_URL,
  CLERK_SIGN_UP_URL,
} from "@/lib/clerk-auth-config";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={omeraClerkAppearance}
      signInUrl={CLERK_SIGN_IN_URL}
      signUpUrl={CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
      signUpFallbackRedirectUrl={CLERK_AFTER_AUTH_URL}
      signInForceRedirectUrl={CLERK_AFTER_AUTH_URL}
      signUpForceRedirectUrl={CLERK_AFTER_AUTH_URL}
    >
      <AppProvider>{children}</AppProvider>
    </ClerkProvider>
  );
}
