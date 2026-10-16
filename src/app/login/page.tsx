"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { useApp } from "@/context/app-provider";

async function completeSession(
  setUserId: (id: string) => void,
  setPersistence: (p: "supabase") => void,
  refreshConversations: () => Promise<void>,
): Promise<boolean> {
  const session = await fetch("/api/auth/session", { cache: "no-store" });
  if (!session.ok) return false;
  const data = (await session.json()) as { userId: string };
  setUserId(data.userId);
  setPersistence("supabase");
  await refreshConversations();
  return true;
}

function LoginForm() {
  const router = useRouter();
  const { setUserId, setPersistence, refreshConversations } = useApp();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "waiting">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const goToChat = useCallback(async () => {
    const ok = await completeSession(setUserId, setPersistence, refreshConversations);
    if (ok) router.push("/chat");
  }, [router, setUserId, setPersistence, refreshConversations]);

  useEffect(() => {
    if (phase !== "waiting") {
      stopPolling();
      return;
    }
    void goToChat();
    pollRef.current = setInterval(() => void goToChat(), 2500);
    return stopPolling;
  }, [phase, goToChat, stopPolling]);

  async function sendLink() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error === "EMAIL_DELIVERY_FAILED"
            ? "Email could not be sent. Try again shortly or check Supabase email settings."
            : "Could not send sign-in link. Try again.",
        );
        return;
      }
      setPhase("waiting");
    } catch {
      setError("Could not send sign-in link. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="liquid-card w-full max-w-md rounded-2xl p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <OmeraWordmark iconSize={40} textClassName="text-3xl" href="/" />
          <h1 className="mt-6 font-serif text-2xl font-medium text-white">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-white/50">
            One email. One link. No password.
          </p>
        </div>

        {error ? (
          <p role="alert" className="mt-6 text-center text-xs text-red-300">
            {error}
          </p>
        ) : null}

        {phase === "email" ? (
          <>
            <label className="mt-8 block text-left text-xs text-white/45">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.za"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendLink();
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void sendLink()}
              disabled={loading || !email.trim()}
              className="mt-4 w-full rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Email me a sign-in link"}
            </button>
          </>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-sm text-white/80">
              Open the email we sent to{" "}
              <span className="text-white">{email}</span>
            </p>
            <p className="mt-3 text-sm text-white/50">
              Tap <strong className="text-white/70">Sign in</strong> or{" "}
              <strong className="text-white/70">Confirm</strong> in that message.
              This page will continue automatically.
            </p>
            <p className="mt-6 text-xs text-white/35">
              Waiting for sign-in… check spam if needed.
            </p>
            <div className="mx-auto mt-4 h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
            <button
              type="button"
              onClick={() => void sendLink()}
              disabled={loading}
              className="mt-8 text-xs text-white/45 hover:text-white/70"
            >
              Resend link
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setError(null);
                stopPolling();
              }}
              className="mt-2 block w-full text-xs text-white/45 hover:text-white/70"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-white/35">
          New here? The same link creates your account.
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
