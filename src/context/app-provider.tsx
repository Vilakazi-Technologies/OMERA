"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
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
  languageExplicit: boolean;
  setLanguageExplicit: (explicit: boolean) => void;
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  createConversation: (mode: "chat" | "form") => Promise<string>;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  formSession: FormSession | null;
  setFormSession: (s: FormSession | null) => void;
  syncError: string | null;
  clearSyncError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "omera-app-v2";

type Persisted = {
  conversations: Conversation[];
  languageId: string;
  languageExplicit: boolean;
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { conversations: [], languageId: "eng", languageExplicit: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], languageId: "eng", languageExplicit: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      conversations: Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [],
      languageId:
        typeof parsed.languageId === "string" ? parsed.languageId : "eng",
      languageExplicit: parsed.languageExplicit === true,
    };
  } catch {
    return { conversations: [], languageId: "eng", languageExplicit: false };
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
  const { isLoaded: clerkLoaded, isSignedIn, userId: clerkUserId } = useAuth();
  const { signOut: clerkSignOut } = useClerk();
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"local" | "supabase">("local");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [languageId, setLanguageIdState] = useState(() => loadPersisted().languageId);
  const [languageExplicit, setLanguageExplicit] = useState(() => loadPersisted().languageExplicit);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadPersisted().conversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formSession, setFormSession] = useState<FormSession | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const clearSyncError = useCallback(() => setSyncError(null), []);

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

  const setLanguageId = useCallback((id: string) => {
    setLanguageIdState(id);
    setLanguageExplicit(true);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!clerkLoaded) return false;
    if (!isSignedIn || !clerkUserId) {
      clearIdentity();
      return false;
    }

    let sessionUserId: string | null = null;
    let mode: "local" | "supabase" = "local";
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          userId: string;
          persistence?: "local" | "supabase";
        };
        if (typeof data.userId === "string" && data.userId) {
          sessionUserId = data.userId;
          if (data.persistence === "local" || data.persistence === "supabase") {
            mode = data.persistence;
          }
        }
      }
    } catch {
      sessionUserId = null;
    }

    if (!sessionUserId) {
      sessionUserId = clerkUserId;
      mode = "local";
    }

    setPersistence(mode);
    setUserId((current) => {
      if (current && current !== sessionUserId) clearPrivateState();
      return sessionUserId;
    });
    return true;
  }, [
    clerkLoaded,
    isSignedIn,
    clerkUserId,
    clearIdentity,
    clearPrivateState,
  ]);

  const logout = useCallback(async () => {
    try {
      await clerkSignOut({ redirectUrl: "/login" });
    } finally {
      clearIdentity();
    }
  }, [clearIdentity, clerkSignOut]);

  const refreshConversations = useCallback(async () => {
    if (persistence !== "supabase" || !userId) return;
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) {
        setSyncError(`REFRESH_CONVERSATIONS_FAILED:${res.status}`);
        return;
      }
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations ?? []);
      setSyncError(null);
    } catch {
      setSyncError("REFRESH_CONVERSATIONS_FAILED:fetch");
    }
  }, [persistence, userId]);

  useEffect(() => {
    if (!clerkLoaded) return;
    const task = setTimeout(() => {
      if (!isSignedIn) {
        clearIdentity();
        setSessionChecked(true);
        return;
      }
      void refreshSession().finally(() => setSessionChecked(true));
    }, 0);
    return () => clearTimeout(task);
  }, [clerkLoaded, isSignedIn, refreshSession, clearIdentity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Persisted = {
      conversations,
      languageId,
      languageExplicit,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private state stays in memory when storage is unavailable.
    }
  }, [conversations, languageId, languageExplicit]);

  useEffect(() => {
    if (sessionChecked && persistence === "supabase" && userId) {
      const task = setTimeout(() => {
        void refreshConversations();
      }, 0);
      return () => clearTimeout(task);
    }
  }, [sessionChecked, persistence, userId, refreshConversations]);

  useEffect(() => {
    if (!sessionChecked || conversations.length === 0) return;
    if (activeId && conversations.some((c) => c.id === activeId)) return;
    const next =
      conversations.find((c) => c.mode === "chat") ?? conversations[0];
    const task = setTimeout(() => setActiveId(next.id), 0);
    return () => clearTimeout(task);
  }, [sessionChecked, conversations, activeId]);

  const createConversation = useCallback(
    async (mode: "chat" | "form") => {
      // Supabase persistence never falls back to local conversations
      // silently: a database failure is recorded visibly and thrown.
      if (persistence === "supabase" && userId) {
        let res: Response;
        try {
          res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          });
        } catch {
          setSyncError("CREATE_CONVERSATION_FAILED:fetch");
          throw new Error("CREATE_CONVERSATION_FAILED:fetch");
        }
        if (!res.ok) {
          setSyncError(`CREATE_CONVERSATION_FAILED:${res.status}`);
          throw new Error(`CREATE_CONVERSATION_FAILED:${res.status}`);
        }
        const data = (await res.json()) as { conversation: Conversation };
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveId(data.conversation.id);
        setSyncError(null);
        return data.conversation.id;
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

  const deleteConversation = useCallback(
    async (id: string) => {
      if (persistence === "supabase" && userId) {
        let res: Response;
        try {
          res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        } catch {
          setSyncError("DELETE_CONVERSATION_FAILED:fetch");
          throw new Error("DELETE_CONVERSATION_FAILED:fetch");
        }
        if (!res.ok) {
          setSyncError(`DELETE_CONVERSATION_FAILED:${res.status}`);
          throw new Error(`DELETE_CONVERSATION_FAILED:${res.status}`);
        }
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setActiveId((current) => {
          if (current !== id) return current;
          return next.find((c) => c.mode === "chat")?.id ?? next[0]?.id ?? null;
        });
        return next;
      });
      setSyncError(null);
    },
    [persistence, userId],
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
      languageExplicit,
      setLanguageExplicit,
      conversations,
      activeId,
      setActiveId,
      createConversation,
      updateConversation,
      deleteConversation,
      refreshConversations,
      formSession,
      setFormSession,
      syncError,
      clearSyncError,
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
      setLanguageId,
      languageExplicit,
      setLanguageExplicit,
      conversations,
      activeId,
      createConversation,
      updateConversation,
      deleteConversation,
      refreshConversations,
      formSession,
      syncError,
      clearSyncError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
