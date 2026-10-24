import "server-only";
import {
  createXavaniChatStream,
  getXavaniConfig,
  xavaniReachable,
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

export function researchHandledByXavani(
  webResearch: boolean,
  provider: ChatProvider | null,
  available: boolean,
): boolean {
  return webResearch && provider === "xavani" && available;
}

export async function createConfiguredChatStream(
  messages: ChatMessage[],
  replyLanguageId: string | null,
  requestSignal?: AbortSignal,
  modelId?: string | null,
  systemContext?: string | null,
  research?: boolean,
): Promise<ReadableStream<Uint8Array>> {
  const provider = resolveChatProvider();
  if (provider === "xavani") {
    if (await xavaniReachable(requestSignal)) {
      return createXavaniChatStream(
        getXavaniConfig(),
        messages,
        replyLanguageId,
        requestSignal,
        systemContext,
        research,
      );
    }
    try {
      return createOpenRouterChatStream(
        getOpenRouterConfig(),
        messages,
        replyLanguageId,
        requestSignal,
        modelId ?? undefined,
        systemContext,
      );
    } catch {
      throw new Error("CHAT_UNAVAILABLE");
    }
  }
  if (provider === "openrouter") {
    return createOpenRouterChatStream(
      getOpenRouterConfig(),
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
