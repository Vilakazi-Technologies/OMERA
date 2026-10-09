"use client";

import { AppProvider } from "@/context/app-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
