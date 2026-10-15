import type { ChatMessage } from "@/lib/types";

/**
 * Client-side bound on the history sent with a chat request. The server
 * enforces the same envelope (at most 40 non-system messages, at most
 * 32000 content characters past the greeting); bounding first keeps huge
 * local histories from burning bandwidth before the server rejects them.
 * The tail always wins: recent context is more valuable than old context.
 */
export const CHAT_HISTORY_MESSAGE_LIMIT = 40;
export const CHAT_HISTORY_CHAR_LIMIT = 32000;

export function boundChatHistory(messages: ChatMessage[]): ChatMessage[] {
  const tail = messages.slice(-CHAT_HISTORY_MESSAGE_LIMIT);
  let total = 0;
  for (const entry of tail) total += entry.content.length;
  if (total <= CHAT_HISTORY_CHAR_LIMIT) {
    return tail.length === messages.length ? messages : tail;
  }
  const bounded: ChatMessage[] = [];
  let kept = 0;
  for (let index = tail.length - 1; index >= 0; index -= 1) {
    const entry = tail[index];
    if (kept + entry.content.length > CHAT_HISTORY_CHAR_LIMIT && bounded.length > 0) {
      break;
    }
    bounded.unshift(
      kept + entry.content.length > CHAT_HISTORY_CHAR_LIMIT
        ? { ...entry, content: entry.content.slice(-CHAT_HISTORY_CHAR_LIMIT) }
        : entry,
    );
    kept += bounded[0].content.length;
    if (kept >= CHAT_HISTORY_CHAR_LIMIT) break;
  }
  return bounded;
}
