"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { useApp } from "@/context/app-provider";

const START_ERROR = "Something went wrong. Try again.";
const CODE_ERROR = "That code is invalid or expired.";

export default function LoginPage() {
  const router = useRouter();
  const { setUserId, setPersistence, refreshConversations } = useApp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(START_ERROR);
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
            Sign in to continue to your workspace.
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
              disabled={loading}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              Send code
            </button>
          </>
        ) : (
          <>
            <label className="mt-8 block text-left text-xs text-white/45">
              One-time code
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
              disabled={loading}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              Verify
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
