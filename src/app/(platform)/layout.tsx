"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setVerified(true);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!verified) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#050505] text-sm text-white/45">
        Loading Omera…
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#050505] text-white">
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col pt-12 md:pt-0">
        {children}
      </main>
    </div>
  );
}
