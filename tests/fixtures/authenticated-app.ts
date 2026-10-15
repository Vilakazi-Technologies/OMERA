import { vi } from "vitest";
import type { Conversation } from "@/lib/types";

/**
 * Shared authenticated-app fixture for protected-page tests.
 * Every protected component reads identity, language, and conversation
 * state through `useApp`; each test file mocked that hook inline with
 * subtly different shapes, so auth regressions in one page never
 * appeared in another. Tests now share this single fixture and only
 * override what their scenario changes.
 */

export type AuthFixtureOverrides = {
  userId?: string | null;
  userName?: string | null;
  persistence?: "local" | "supabase";
  sessionChecked?: boolean;
  languageId?: string;
  languageExplicit?: boolean;
  conversations?: Conversation[];
  activeId?: string | null;
  syncError?: string | null;
};

type FixtureState = {
  userId: string | null;
  userName: string | null;
  persistence: "local" | "supabase";
  sessionChecked: boolean;
  languageId: string;
  languageExplicit: boolean;
  conversations: Conversation[];
  activeId: string | null;
  syncError: string | null;
};

function defaultConversations(): Conversation[] {
  return [
    {
      id: "conv-1",
      title: "New chat",
      mode: "chat",
      messages: [],
      updatedAt: Date.now(),
    },
  ];
}

const state: FixtureState = {
  userId: "omera-user-1",
  userName: "Thendo",
  persistence: "local",
  sessionChecked: true,
  languageId: "eng",
  languageExplicit: false,
  conversations: defaultConversations(),
  activeId: "conv-1",
  syncError: null,
};

export const authFixtureFns = {
  setUserName: vi.fn(),
  setUserId: vi.fn(),
  setPersistence: vi.fn(),
  refreshSession: vi.fn(async () => true),
  logout: vi.fn(async () => undefined),
  setSidebarOpen: vi.fn(),
  setActiveId: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  refreshConversations: vi.fn(async () => undefined),
  setFormSession: vi.fn(),
  clearSyncError: vi.fn(),
};

export function resetAuthFixture(overrides: AuthFixtureOverrides = {}): void {
  state.userId = overrides.userId ?? "omera-user-1";
  state.userName = overrides.userName ?? "Thendo";
  state.persistence = overrides.persistence ?? "local";
  state.sessionChecked = overrides.sessionChecked ?? true;
  state.languageId = overrides.languageId ?? "eng";
  state.languageExplicit = overrides.languageExplicit ?? false;
  state.conversations = overrides.conversations ?? defaultConversations();
  state.activeId = overrides.activeId ?? "conv-1";
  state.syncError = overrides.syncError ?? null;
  for (const fn of Object.values(authFixtureFns)) fn.mockReset();
  authFixtureFns.refreshSession.mockResolvedValue(true);
}

/** Live view of the fixture: selecting a language marks it explicit. */
export function authAppValue() {
  return {
    userName: state.userName,
    setUserName: authFixtureFns.setUserName,
    userId: state.userId,
    setUserId: authFixtureFns.setUserId,
    persistence: state.persistence,
    setPersistence: authFixtureFns.setPersistence,
    sessionChecked: state.sessionChecked,
    refreshSession: authFixtureFns.refreshSession,
    logout: authFixtureFns.logout,
    sidebarOpen: true,
    setSidebarOpen: authFixtureFns.setSidebarOpen,
    languageId: state.languageId,
    setLanguageId: (id: string) => {
      state.languageId = id;
      state.languageExplicit = true;
    },
    languageExplicit: state.languageExplicit,
    setLanguageExplicit: (explicit: boolean) => {
      state.languageExplicit = explicit;
    },
    conversations: state.conversations,
    activeId: state.activeId,
    setActiveId: authFixtureFns.setActiveId,
    createConversation: authFixtureFns.createConversation,
    updateConversation: authFixtureFns.updateConversation,
    refreshConversations: authFixtureFns.refreshConversations,
    formSession: null,
    setFormSession: authFixtureFns.setFormSession,
    syncError: state.syncError,
    clearSyncError: authFixtureFns.clearSyncError,
  };
}

/** Direct state access for assertions (prefer behavior assertions). */
export function authFixtureState(): Readonly<FixtureState> {
  return state;
}
