"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { useApp } from "@/context/app-provider";

export default function LoginPage() {
  const router = useRouter();
  const { setUserName, setUserId, setPersistence, refreshConversations } =
    useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function continueToApp() {
    setLoading(true);
    const name = email.trim() || "Omera user";
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          displayName: name,
        }),
      });
      const data = (await res.json()) as {
        userId: string | null;
        displayName: string;
        persistence: "local" | "supabase";
      };
      setUserName(data.displayName);
      setUserId(data.userId);
      setPersistence(data.persistence);
      if (data.persistence === "supabase") {
        await refreshConversations();
      }
    } catch {
      setUserName(name);
    }
    router.push("/chat");
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
          onClick={continueToApp}
          disabled={loading}
          className="mt-4 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
        >
          Continue
        </button>

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
