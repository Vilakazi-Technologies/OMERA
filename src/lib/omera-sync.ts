type ChatRole = "user" | "assistant";

/**
 * Check every save status. A non-OK response or an unreadable body is a
 * visible failure — callers never treat it as a silent success.
 */
export async function assertSaveResponse(
  response: Response,
  failureCode: string,
): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${failureCode}:${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${failureCode}:INVALID_JSON`);
  }
}

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
  return assertSaveResponse(response, failureCode);
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
  return assertSaveResponse(response, "PERSIST_TITLE_FAILED");
}

export async function persistFormSession(
  sessionId: string,
  patch: {
    answers: Record<string, string | boolean>;
    revision: number;
    currentIndex?: number;
  },
) {
  const response = await fetch(`/api/forms/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return assertSaveResponse(response, "PERSIST_FORM_SESSION_FAILED");
}
