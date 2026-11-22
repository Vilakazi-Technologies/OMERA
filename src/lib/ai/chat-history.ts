import type { ModelTurn } from "@/lib/ai/advisor-memory";
import type { ChatMessage } from "@/lib/types";

/**
 * Bound on the history sent with a chat request. The server enforces the
 * same envelope (at most 40 non-system messages, at most 32000 content
 * characters). Bounding first keeps huge histories from burning bandwidth
 * before the server rejects them. The tail always wins.
 */
export const CHAT_HISTORY_MESSAGE_LIMIT = 40;
export const CHAT_HISTORY_CHAR_LIMIT = 32000;

function boundByContent<T extends { content: string }>(messages: T[]): T[] {
  const tail = messages.slice(-CHAT_HISTORY_MESSAGE_LIMIT);
  let total = 0;
  for (const entry of tail) total += entry.content.length;
  if (total <= CHAT_HISTORY_CHAR_LIMIT) {
    return tail.length === messages.length ? messages : tail;
  }
  const bounded: T[] = [];
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

export function boundChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return boundByContent(messages);
}

export function boundModelMessages(messages: ModelTurn[]): ModelTurn[] {
  return boundByContent(messages);
}

function sameTurn(left: ModelTurn, right: ModelTurn): boolean {
  return left.role === right.role && left.content === right.content;
}

/**
 * The open thread the model should see. When the client sends the full
 * recent thread, that wins (it includes the unsaved latest turn). When the
 * client sends only the latest turn, stored messages fill in the rest.
 */
export function threadForModel(stored: ModelTurn[], incoming: ModelTurn[]): ModelTurn[] {
  if (incoming.length === 0) return boundModelMessages(stored);
  if (stored.length === 0) return boundModelMessages(incoming);

  if (incoming.length >= stored.length) {
    const headMatches = incoming
      .slice(0, stored.length)
      .every((message, index) => sameTurn(message, stored[index]));
    if (headMatches) return boundModelMessages(incoming);
  }

  let overlap = 0;
  const max = Math.min(stored.length, incoming.length);
  for (let size = max; size >= 1; size -= 1) {
    const storedTail = stored.slice(stored.length - size);
    const incomingHead = incoming.slice(0, size);
    if (storedTail.every((message, index) => sameTurn(message, incomingHead[index]))) {
      overlap = size;
      break;
    }
  }
  if (overlap === incoming.length) return boundModelMessages(stored);
  if (overlap > 0) return boundModelMessages([...stored, ...incoming.slice(overlap)]);
  return boundModelMessages([...stored, ...incoming]);
}
