"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { useApp } from "@/context/app-provider";

const START_ERROR = "Something went wrong. Try again.";
const EMAIL_ERROR =
  "We could not send email. Check Supabase auth settings or try again in a few minutes.";
const CODE_ERROR = "That code is invalid or expired.";

const CALLBACK_ERRORS: Record<string, string> = {
  missing_code: "That sign-in link is incomplete. Request a new code below.",
  auth_callback: "That sign-in link expired. Enter your email and use a fresh code.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUserId, setPersistence, refreshConversations } = useApp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = searchParams.get("error");
    if (key && CALLBACK_ERRORS[key]) setError(CALLBACK_ERRORS[key]);
  }, [searchParams]);

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error === "EMAIL_DELIVERY_FAILED" ? EMAIL_ERROR : START_ERROR,
        );
        return;
      }
      setStep("code");
    } catch {
      setError(START_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: code.trim() }),
      });
      if (!res.ok) {
        setError(CODE_ERROR);
        return;
      }
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (!session.ok) {
        setError(START_ERROR);
        return;
      }
      const data = (await session.json()) as { userId: string };
      setUserId(data.userId);
      setPersistence("supabase");
      await refreshConversations();
      router.push("/chat");
    } catch {
      setError(START_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="liquid-card w-full max-w-md rounded-2xl p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <OmeraWordmark iconSize={40} textClassName="text-3xl" href="/" />
          <p className="mt-6 text-sm text-white/50">
            Sign in with email only. Your account is created the first time you
            verify a code — ignore any email that says &quot;sign up&quot; and
            stay on this page.
          </p>
        </div>

        {error ? (
          <p role="alert" className="mt-6 text-center text-xs text-red-300">
            {error}
          </p>
        ) : null}

        {step === "email" ? (
          <>
            <label className="mt-8 block text-left text-xs text-white/45">
              Work email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.za"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
              />
            </label>

            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={loading || !email.trim()}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              Send code
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-white/40">
              <strong className="font-medium text-white/60">Use the 6-digit code</strong>{" "}
              on the next screen. Do not open Supabase or other sign-up pages —
              only this Omera login.
            </p>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-left text-xs leading-relaxed text-white/75">
              <p className="font-medium text-emerald-100/95">
                1. Open the email from Supabase / Omera
              </p>
              <p className="mt-2">
                Tap <strong>Confirm your mail</strong>,{" "}
                <strong>Log in</strong>, or <strong>Magic Link</strong> — you
                should land in Omera chat.{" "}
                <strong>No code is required</strong> if the button works.
              </p>
              <p className="mt-3 font-medium text-white/80">
                2. Only if you see a number in the email
              </p>
              <p className="mt-1">Enter the 6-digit code below.</p>
            </div>
            <p className="mt-4 text-center text-xs text-white/40">
              Sent to <span className="text-white/60">{email}</span> — check
              spam. Wait up to 2 minutes.
            </p>
            <label className="mt-4 block text-left text-xs text-white/45">
              6-digit code (optional if you used the email link)
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
              />
            </label>

            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={loading || !code.trim()}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              Verify and continue
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={loading}
              className="mt-3 w-full text-center text-xs text-white/45 hover:text-white/70"
            >
              Resend email
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="mt-2 w-full text-center text-xs text-white/45 hover:text-white/70"
            >
              Use a different email
            </button>
          </>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
          By continuing you agree to VILATECH&apos;s terms and privacy policy.
        </p>
      </div>

      <Link
        href="/"
        className="mt-8 text-sm text-white/45 hover:text-white/70"
      >
        ← Back to home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-white/45">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
