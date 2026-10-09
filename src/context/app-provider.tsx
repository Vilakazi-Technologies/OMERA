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
  userName: string | null;
  userId: string | null;
  persistence: "local" | "supabase";
  conversations: Conversation[];
  languageId: string;
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return {
      userName: null,
      userId: null,
      persistence: "local",
      conversations: [],
      languageId: "eng",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        userName: null,
        userId: null,
        persistence: "local",
        conversations: [],
        languageId: "eng",
      };
    }
    return JSON.parse(raw) as Persisted;
  } catch {
    return {
      userName: null,
      userId: null,
      persistence: "local",
      conversations: [],
      languageId: "eng",
    };
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"local" | "supabase">("local");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [languageId, setLanguageId] = useState("eng");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formSession, setFormSession] = useState<FormSession | null>(null);

  const refreshConversations = useCallback(async () => {
    if (persistence !== "supabase" || !userId) return;
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations ?? []);
  }, [persistence, userId]);

  useEffect(() => {
    const data = loadPersisted();
    setUserName(data.userName);
    setUserId(data.userId);
    setPersistence(data.persistence);
    setConversations(data.conversations);
    setLanguageId(data.languageId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: Persisted = {
      userName,
      userId,
      persistence,
      conversations,
      languageId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, userName, userId, persistence, conversations, languageId]);

  useEffect(() => {
    if (hydrated && persistence === "supabase" && userId) {
      refreshConversations();
    }
  }, [hydrated, persistence, userId, refreshConversations]);

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
      setPersistence,
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
