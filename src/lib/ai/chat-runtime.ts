import "server-only";
import {
  createXavaniChatStream,
  getXavaniConfig,
} from "@/lib/ai/xavani-client";
import {
  createOpenRouterChatStream,
  getOpenRouterConfig,
} from "@/lib/ai/openrouter-client";
import { completeXavaniJson } from "@/lib/ai/xavani-client";
import { completeOpenRouterJson } from "@/lib/ai/openrouter-client";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatProvider = "xavani" | "openrouter";

export function resolveChatProvider(env: NodeJS.ProcessEnv = process.env): ChatProvider | null {
  try {
    getXavaniConfig(env);
    return "xavani";
  } catch {
    try {
      getOpenRouterConfig(env);
      return "openrouter";
    } catch {
      return null;
    }
  }
}

export function createConfiguredChatStream(
  messages: ChatMessage[],
  replyLanguageId: string | null,
  requestSignal?: AbortSignal,
  modelId?: string | null,
  systemContext?: string | null,
): ReadableStream<Uint8Array> {
  const provider = resolveChatProvider();
  if (provider === "xavani") {
    const config = getXavaniConfig();
    return createXavaniChatStream(
      config,
      messages,
      replyLanguageId,
      requestSignal,
      systemContext,
    );
  }
  if (provider === "openrouter") {
    const config = getOpenRouterConfig();
    return createOpenRouterChatStream(
      config,
      messages,
      replyLanguageId,
      requestSignal,
      modelId ?? undefined,
      systemContext,
    );
  }
  throw new Error("CHAT_UNAVAILABLE");
}

export async function completeConfiguredJson<T>(
  systemPrompt: string,
  input: string,
  parse: (value: unknown) => T,
  requestSignal?: AbortSignal,
): Promise<T> {
  const provider = resolveChatProvider();
  if (provider === "xavani") {
    return completeXavaniJson(getXavaniConfig(), systemPrompt, input, parse, requestSignal);
  }
  if (provider === "openrouter") {
    return completeOpenRouterJson(
      getOpenRouterConfig(),
      systemPrompt,
      input,
      parse,
      requestSignal,
    );
  }
  throw new Error("CHAT_UNAVAILABLE");
}
