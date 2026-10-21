import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignUpSsoCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] text-sm text-white/50">
      <AuthenticateWithRedirectCallback />
      <p className="sr-only">Completing sign up…</p>
    </div>
  );
}
