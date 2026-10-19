"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { useApp } from "@/context/app-provider";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { refreshSession } = useApp();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    void refreshSession();
  }, [isLoaded, isSignedIn, router, refreshSession]);

  if (!isLoaded || !isSignedIn) {
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
