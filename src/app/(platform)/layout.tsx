"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useApp } from "@/context/app-provider";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userName } = useApp();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!userName) {
      router.replace("/login");
    }
  }, [ready, userName, router]);

  if (!ready || !userName) {
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
