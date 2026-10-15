"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FileText,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Sparkles,
} from "lucide-react";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { VilatechLogo } from "@/components/vilatech-logo";
import { useApp } from "@/context/app-provider";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarOpen,
    setSidebarOpen,
    conversations,
    activeId,
    setActiveId,
    createConversation,
    userId,
    logout,
  } = useApp();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setSidebarOpen]);

  return (
    <>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-40 rounded-full border border-white/10 bg-[#050505]/90 p-2.5 text-white/80 backdrop-blur-md md:left-4 md:top-4"
          aria-label="Open menu"
        >
          <PanelLeft className="size-5" />
        </button>
      )}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100%,288px)] flex-col border-r border-white/10 bg-[#050505]/98 backdrop-blur-xl transition-transform duration-300 md:relative md:z-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 p-4">
          <OmeraWordmark href="/chat" iconSize={28} textClassName="text-lg" />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1 p-2">
          <button
            type="button"
            onClick={() => {
            void createConversation("chat");
            router.push("/chat");
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/90 transition hover:bg-white/8"
          >
            <MessageSquarePlus className="size-4 text-white/70" />
            New chat
          </button>
          <Link
            href="/form"
            onClick={() => {
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/8",
              pathname === "/form"
                ? "bg-white/10 text-white"
                : "text-white/90",
            )}
          >
            <FileText className="size-4 text-white/60" />
            Form fill
          </Link>
        </div>

        <div className="px-3 py-2">
          <p className="text-[11px] font-medium tracking-wider text-white/35 uppercase">
            Recent
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <p className="px-3 text-xs text-white/40">No chats yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveId(c.id);
                  router.push(c.mode === "form" ? "/form" : "/chat");
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-sm transition",
                  activeId === c.id
                    ? "bg-white/10 text-white"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80",
                )}
              >
                {c.mode === "form" ? (
                  <FileText className="size-3.5 shrink-0" />
                ) : (
                  <Sparkles className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{c.title}</span>
              </button>
            ))
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2">
            <VilatechLogo size={22} />
            <p className="truncate text-xs text-white/45">
              {userId ? `Verified · ${userId.slice(0, 8)}` : "Not signed in"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout().finally(() => router.push("/login"));
            }}
            className="mt-3 flex items-center gap-2 text-xs text-white/40 hover:text-white/70"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
