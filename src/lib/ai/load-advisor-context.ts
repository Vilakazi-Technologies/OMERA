import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import {
  memoryFromStoredChats,
  renderAdvisorMemory,
  type AccountMemory,
  type StoredChat,
} from "@/lib/ai/advisor-memory";
import { SA_LANGUAGES } from "@/lib/languages";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function clerkPersonName(): Promise<string | null> {
  try {
    const user = await currentUser();
    const name = user?.fullName?.trim() || user?.firstName?.trim() || "";
    if (!name || name === "Omera user") return null;
    return name;
  } catch {
    return null;
  }
}

function languageName(replyLanguageId: string | null): string | null {
  if (!replyLanguageId) return null;
  return SA_LANGUAGES.find((language) => language.id === replyLanguageId)?.nativeName ?? null;
}

async function loadStoredAccount(
  userId: string,
  conversationId?: string,
): Promise<{ name: string | null; account: AccountMemory }> {
  const supabase = getSupabaseAdmin();
  const [userResult, chatResult] = await Promise.all([
    supabase.from("omera_users").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("omera_conversations")
      .select("id, title, updated_at, omera_messages ( role, content, created_at )")
      .eq("user_id", userId)
      .eq("mode", "chat")
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  if (userResult.error) throw userResult.error;
  if (chatResult.error) throw chatResult.error;

  const displayName = (userResult.data?.display_name as string | undefined)?.trim() || null;
  const chats: StoredChat[] = (chatResult.data ?? []).map((row) => {
    const messages = (row.omera_messages ?? []) as {
      role: string;
      content: string;
      created_at: string;
    }[];
    return {
      id: row.id as string,
      title: (row.title as string) || "Chat",
      updatedAt: new Date(row.updated_at as string).getTime(),
      messages: messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: new Date(message.created_at).getTime(),
      })),
    };
  });
  return {
    name: displayName && displayName !== "Omera user" ? displayName : null,
    account: memoryFromStoredChats(chats, conversationId),
  };
}

/**
 * Context block for this turn: name, reply language, business facts already
 * in earlier chats, and a short recall of those chats.
 * Cloud accounts read Supabase. Local accounts use the snapshot the browser
 * built from its own chat store. A lookup failure still lets the reply go out.
 */
export async function loadAdvisorModelContext(input: {
  userId: string;
  cloud: boolean;
  conversationId?: string;
  replyLanguageId: string | null;
  accountMemory?: AccountMemory | null;
}): Promise<string | null> {
  let storedName: string | null = null;
  let account: AccountMemory = { facts: [], priorChats: [] };

  if (input.cloud) {
    try {
      const stored = await loadStoredAccount(input.userId, input.conversationId);
      storedName = stored.name;
      account = stored.account;
    } catch {
      // Memory is optional. The advisor still answers this turn.
    }
  } else if (input.accountMemory) {
    account = input.accountMemory;
  }

  const clerkName = await clerkPersonName();
  return renderAdvisorMemory({
    name: clerkName ?? storedName,
    languageName: languageName(input.replyLanguageId),
    facts: account.facts,
    priorChats: account.priorChats,
  });
}
