"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AppProvider } from "@/context/app-provider";
import { omeraClerkAppearance } from "@/lib/clerk-appearance";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={omeraClerkAppearance}
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/chat"
      signUpFallbackRedirectUrl="/chat"
    >
      <AppProvider>{children}</AppProvider>
    </ClerkProvider>
  );
}
