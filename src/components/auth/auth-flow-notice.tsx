"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";

function NoticeCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "success" | "info";
}) {
  const styles =
    tone === "success"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : "border-sky-400/25 bg-sky-500/10 text-sky-100";
  return (
    <div
      role="status"
      className={`mb-5 w-full rounded-2xl border px-4 py-3 text-left ${styles}`}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 opacity-90">{icon}</div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function AuthFlowNotice({ mode }: { mode: "sign-in" | "sign-up" }) {
  const params = useSearchParams();
  const from = params.get("from");
  const verified =
    params.get("verified") === "1" ||
    params.get("confirmed") === "1" ||
    from === "email-confirmed";

  if (verified && mode === "sign-in") {
    return (
      <NoticeCard
        tone="success"
        icon={<CheckCircle2 className="size-5" aria-hidden />}
        title="Email confirmed"
        body="Sign in with the same email address you used to register. You will go straight to Omera."
      />
    );
  }

  if (mode === "sign-up" && !verified) {
    return (
      <NoticeCard
        tone="info"
        icon={<Mail className="size-5" aria-hidden />}
        title="What happens next"
        body="After you create your account, we email you a confirmation link. Once you have confirmed, return here and sign in with that same email — no second registration."
      />
    );
  }

  return null;
}
