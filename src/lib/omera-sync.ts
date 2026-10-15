type ChatRole = "user" | "assistant";

async function persistJson(
  url: string,
  body: unknown,
  failureCode: string,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${failureCode}:${response.status}`);
  }
  return response.json();
}

/**
 * Completed assistant answers, keyed by the stable client message ID the
 * chat page holds for the whole stream. A retry that replays the same ID
 * never persists twice.
 */
const persistedAssistantIds = new Set<string>();

export async function persistMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
) {
  return persistJson(
    `/api/conversations/${conversationId}/messages`,
    { role, content },
    "PERSIST_MESSAGE_FAILED",
  );
}

export async function persistCompletedAnswer(
  conversationId: string,
  messageId: string,
  content: string,
  completed: boolean,
): Promise<boolean> {
  if (!completed) return false;
  if (!content.trim()) return false;
  if (persistedAssistantIds.has(messageId)) return false;
  await persistMessage(conversationId, "assistant", content);
  persistedAssistantIds.add(messageId);
  return true;
}

export async function persistConversationTitle(
  conversationId: string,
  title: string,
) {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(`PERSIST_TITLE_FAILED:${response.status}`);
  }
  return response.json();
}

export async function persistFormSession(
  sessionId: string,
  patch: {
    fields?: unknown;
    currentIndex?: number;
    status?: "in_progress" | "completed";
  },
) {
  const response = await fetch(`/api/forms/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`PERSIST_FORM_SESSION_FAILED:${response.status}`);
  }
  return response.json();
}
