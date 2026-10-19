import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage, Conversation } from "@/lib/types";

function mapConversation(row: {
  id: string;
  title: string;
  mode: string;
  updated_at: string;
  messages?: { id: string; role: string; content: string; created_at: string }[];
}): Conversation {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode as "chat" | "form",
    updatedAt: new Date(row.updated_at).getTime(),
    messages: (row.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role as ChatMessage["role"],
      content: m.content,
      createdAt: new Date(m.created_at).getTime(),
    })),
  };
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_conversations")
    .select(
      `
      id,
      title,
      mode,
      updated_at,
      omera_messages ( id, role, content, created_at )
    `,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapConversation({
      ...row,
      messages: (row.omera_messages ?? []) as {
        id: string;
        role: string;
        content: string;
        created_at: string;
      }[],
    }),
  );
}

export async function createConversation(
  userId: string,
  mode: "chat" | "form",
  title?: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_conversations")
    .insert({
      user_id: userId,
      mode,
      title: title ?? (mode === "form" ? "Form fill" : "New chat"),
    })
    .select("id, title, mode, updated_at")
    .single();
  if (error) throw error;
  return mapConversation({ ...data, messages: [] });
}

export async function getConversation(conversationId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_conversations")
    .select(
      `
      id,
      title,
      mode,
      updated_at,
      omera_messages ( id, role, content, created_at )
    `,
    )
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapConversation({
    ...data,
    messages: (data.omera_messages ?? []) as {
      id: string;
      role: string;
      content: string;
      created_at: string;
    }[],
  });
}

export async function touchConversation(conversationId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("omera_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function updateConversationMeta(
  conversationId: string,
  patch: { title?: string },
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("omera_conversations")
    .update(patch)
    .eq("id", conversationId);
  if (error) throw error;
}

export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const existing = await getConversation(conversationId, userId);
  if (!existing) return false;
  const { error: messagesError } = await supabase
    .from("omera_messages")
    .delete()
    .eq("conversation_id", conversationId);
  if (messagesError) throw messagesError;
  const { error } = await supabase
    .from("omera_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
) {
  if (role === "system") throw new Error("SYSTEM_MESSAGES_REJECTED");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("id, role, content, created_at")
    .single();
  if (error) throw error;
  await touchConversation(conversationId);
  return {
    id: data.id as string,
    role: data.role as ChatMessage["role"],
    content: data.content as string,
    createdAt: new Date(data.created_at as string).getTime(),
  };
}
