import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { CLERK_SIGN_IN_URL } from "@/lib/clerk-auth-config";

export const metadata = {
  title: "Email confirmed",
};

export default function EmailConfirmedPage() {
  const signInHref = `${CLERK_SIGN_IN_URL}?from=email-confirmed`;

  return (
    <AuthPageShell subtitle="You're one step away from Omera.">
      <div className="flex flex-col items-center px-2 py-4 text-center sm:px-4 sm:py-6">
        <div className="flex size-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
          <CheckCircle2 className="size-7 text-emerald-300" aria-hidden />
        </div>
        <h2 className="mt-5 font-serif text-2xl font-medium text-white">
          Email address confirmed
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
          Thank you for verifying. For security, open Omera by{" "}
          <span className="text-white/85">signing in</span> with the same email
          you just confirmed. We will take you to chat automatically.
        </p>
        <Link
          href={signInHref}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-8 text-sm font-medium text-black transition hover:bg-white/90"
        >
          Continue to sign in
        </Link>
        <p className="mt-4 text-xs text-white/40">
          Wrong inbox? Use the email that received the confirmation link.
        </p>
      </div>
    </AuthPageShell>
  );
}
