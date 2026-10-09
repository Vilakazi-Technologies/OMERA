export async function persistMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
) {
  await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
}

export async function persistConversationTitle(
  conversationId: string,
  title: string,
) {
  await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function persistFormSession(
  sessionId: string,
  patch: {
    fields?: unknown;
    currentIndex?: number;
    status?: "in_progress" | "completed";
  },
) {
  await fetch(`/api/forms/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
