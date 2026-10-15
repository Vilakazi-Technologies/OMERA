"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Conversation, FormSession } from "@/lib/types";

type AppContextValue = {
  userName: string | null;
  setUserName: (name: string | null) => void;
  userId: string | null;
  setUserId: (id: string | null) => void;
  persistence: "local" | "supabase";
  setPersistence: (mode: "local" | "supabase") => void;
  sessionChecked: boolean;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  languageId: string;
  setLanguageId: (id: string) => void;
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  createConversation: (mode: "chat" | "form") => Promise<string>;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  refreshConversations: () => Promise<void>;
  formSession: FormSession | null;
  setFormSession: (s: FormSession | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "omera-app-v2";

type Persisted = {
  conversations: Conversation[];
  languageId: string;
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { conversations: [], languageId: "eng" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], languageId: "eng" };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      conversations: Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [],
      languageId:
        typeof parsed.languageId === "string" ? parsed.languageId : "eng",
    };
  } catch {
    return { conversations: [], languageId: "eng" };
  }
}

function clearLocalCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; in-memory state is still cleared.
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"local" | "supabase">("local");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [languageId, setLanguageId] = useState("eng");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formSession, setFormSession] = useState<FormSession | null>(null);

  const clearPrivateState = useCallback(() => {
    setConversations([]);
    setActiveId(null);
    setFormSession(null);
    clearLocalCache();
  }, []);

  const clearIdentity = useCallback(() => {
    setUserId(null);
    setUserName(null);
    setPersistence("local");
    clearPrivateState();
  }, [clearPrivateState]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    let sessionUserId: string | null = null;
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { userId: string };
        if (typeof data.userId === "string" && data.userId) {
          sessionUserId = data.userId;
        }
      }
    } catch {
      sessionUserId = null;
    }
    if (!sessionUserId) {
      clearIdentity();
      return false;
    }
    setUserId((current) => {
      if (current && current !== sessionUserId) clearPrivateState();
      return sessionUserId;
    });
    setPersistence("supabase");
    return true;
  }, [clearIdentity, clearPrivateState]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearIdentity();
    }
  }, [clearIdentity]);

  const refreshConversations = useCallback(async () => {
    if (persistence !== "supabase" || !userId) return;
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations ?? []);
  }, [persistence, userId]);

  useEffect(() => {
    const data = loadPersisted();
    setConversations(data.conversations);
    setLanguageId(data.languageId);
    void refreshSession().finally(() => setSessionChecked(true));
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Persisted = { conversations, languageId };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private state stays in memory when storage is unavailable.
    }
  }, [conversations, languageId]);

  useEffect(() => {
    if (sessionChecked && persistence === "supabase" && userId) {
      void refreshConversations();
    }
  }, [sessionChecked, persistence, userId, refreshConversations]);

  const createConversation = useCallback(
    async (mode: "chat" | "form") => {
      if (persistence === "supabase" && userId) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        if (res.ok) {
          const data = (await res.json()) as { conversation: Conversation };
          setConversations((prev) => [data.conversation, ...prev]);
          setActiveId(data.conversation.id);
          return data.conversation.id;
        }
      }

      const id = crypto.randomUUID();
      const conv: Conversation = {
        id,
        title: mode === "form" ? "Form fill" : "New chat",
        messages: [],
        updatedAt: Date.now(),
        mode,
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(id);
      return id;
    },
    [persistence, userId],
  );

  const updateConversation = useCallback(
    (id: string, patch: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      userName,
      setUserName,
      userId,
      setUserId,
      persistence,
      setPersistence,
      sessionChecked,
      refreshSession,
      logout,
      sidebarOpen,
      setSidebarOpen,
      languageId,
      setLanguageId,
      conversations,
      activeId,
      setActiveId,
      createConversation,
      updateConversation,
      refreshConversations,
      formSession,
      setFormSession,
    }),
    [
      userName,
      userId,
      persistence,
      sessionChecked,
      refreshSession,
      logout,
      sidebarOpen,
      languageId,
      conversations,
      activeId,
      createConversation,
      updateConversation,
      refreshConversations,
      formSession,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
