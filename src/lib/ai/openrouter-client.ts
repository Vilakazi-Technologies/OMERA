import "server-only";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";
import {
  openRouterModelChain,
  resolveOpenRouterModelId,
} from "@/lib/ai/openrouter-models";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterConfig = { apiKey: string; model: string };

export function isOpenRouterConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

export function getOpenRouterConfig(env: NodeJS.ProcessEnv = process.env): OpenRouterConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = resolveOpenRouterModelId(env);
  if (!apiKey) throw new Error("OPENROUTER_UNAVAILABLE");
  if (/[\r\n]/.test(apiKey)) throw new Error("INVALID_OPENROUTER_KEY");
  return { apiKey, model };
}

type Message = { role: "user" | "assistant"; content: string };

function maxOutputTokens(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.OPENROUTER_MAX_TOKENS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 1600;
  if (!Number.isFinite(parsed) || parsed < 256 || parsed > 4096) return 1600;
  return parsed;
}

function requestBody(
  config: OpenRouterConfig,
  messages: Message[],
  systemPrompt: string,
  stream: boolean,
  env: NodeJS.ProcessEnv = process.env,
) {
  const models = openRouterModelChain(config.model, env);
  return JSON.stringify({
    model: models[0],
    models,
    stream,
    max_tokens: maxOutputTokens(env),
    provider: { sort: "latency", allow_fallbacks: true },
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function post(
  config: OpenRouterConfig,
  body: string,
  signal: AbortSignal,
): Promise<Response> {
  const attempts = 4;
  let lastError: unknown = new Error("OPENROUTER_UNAVAILABLE");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal.aborted) throw new Error("OPENROUTER_ABORTED");
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.APP_ORIGIN?.trim() || "https://vilatech-ai.vercel.app",
          "X-Title": "Omera by VILATECH",
        },
        body,
        signal,
        redirect: "error",
        cache: "no-store",
      });
      if (response.status === 429 || response.status >= 502) {
        await response.body?.cancel();
        lastError = new Error("OPENROUTER_RATE_LIMITED");
        await pause(400 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("OPENROUTER_UNAVAILABLE");
      }
      return response;
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      if (attempt < attempts - 1) await pause(400 * (attempt + 1));
    }
  }
  throw lastError;
}

function tokenFromOpenRouterChunk(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  if ("error" in parsed) {
    throw new Error("OPENROUTER_ERROR");
  }
  const record = parsed as {
    choices?: {
      delta?: { content?: string | null; reasoning?: string | null; text?: string | null };
      message?: { content?: string | null };
      text?: string | null;
    }[];
  };
  const choice = record.choices?.[0];
  if (!choice) return null;
  const delta = choice.delta;
  if (delta) {
    for (const key of ["content", "reasoning", "text"] as const) {
      const part = delta[key];
      if (typeof part === "string" && part.length > 0) return part;
    }
  }
  const messageContent = choice.message?.content;
  if (typeof messageContent === "string" && messageContent.length > 0) {
    return messageContent;
  }
  const text = choice.text;
  if (typeof text === "string" && text.length > 0) return text;
  return null;
}

async function* streamTokens(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new Error("INVALID_OPENROUTER_STREAM");
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.includes("text/event-stream") &&
    !contentType.includes("application/octet-stream")
  ) {
    await response.body.cancel();
    throw new Error("INVALID_OPENROUTER_STREAM");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let visible = false;
  try {
    while (true) {
      const chunk = await reader.read();
      pending += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      pending = pending.replace(/\r\n/g, "\n");
      if (pending.length > 262144) throw new Error("OPENROUTER_EVENT_TOO_LARGE");
      let boundary = pending.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data === "[DONE]") {
          if (!visible) throw new Error("INCOMPLETE_OPENROUTER_STREAM");
          return;
        }
        if (data) {
          const token = tokenFromOpenRouterChunk(JSON.parse(data) as unknown);
          if (token) {
            visible = true;
            yield token;
          }
        }
        boundary = pending.indexOf("\n\n");
      }
      if (chunk.done) {
        if (!visible) throw new Error("INCOMPLETE_OPENROUTER_STREAM");
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function withModel(config: OpenRouterConfig, modelOverride?: string): OpenRouterConfig {
  if (!modelOverride?.trim()) return config;
  return { ...config, model: modelOverride.trim() };
}

export function createOpenRouterChatStream(
  config: OpenRouterConfig,
  messages: Message[],
  replyLanguageId: string | null = null,
  requestSignal?: AbortSignal,
  modelOverride?: string,
  systemContext?: string | null,
): ReadableStream<Uint8Array> {
  const active = withModel(config, modelOverride);
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(120000),
    ...(requestSignal ? [requestSignal] : []),
  ]);
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(output) {
      const streamAttempts = 3;
      for (let attempt = 0; attempt < streamAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const response = await post(
            active,
            requestBody(
              active,
              messages,
              buildOmeraSystemPrompt(replyLanguageId, systemContext),
              true,
            ),
            signal,
          );
          for await (const token of streamTokens(response)) {
            if (cancelled) return;
            output.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
          if (!cancelled) {
            output.enqueue(encoder.encode("data: [DONE]\n\n"));
            output.close();
          }
          return;
        } catch {
          if (cancelled) return;
          if (attempt < streamAttempts - 1) {
            await pause(500 * (attempt + 1));
            continue;
          }
          output.enqueue(encoder.encode('data: {"error":"CHAT_UNAVAILABLE"}\n\n'));
          output.close();
        }
      }
    },
    cancel() {
      cancelled = true;
      controller.abort();
    },
  });
}

export async function completeOpenRouterJsonString(
  config: OpenRouterConfig,
  systemPrompt: string,
  input: string,
  requestSignal?: AbortSignal,
): Promise<string> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(120000),
    ...(requestSignal ? [requestSignal] : []),
  ]);
  const response = await post(
    config,
    JSON.stringify({
      model: config.model,
      stream: false,
      max_tokens: maxOutputTokens(),
      response_format: { type: "json_object" },
      provider: { sort: "latency", allow_fallbacks: true },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    }),
    signal,
  );
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("INVALID_OPENROUTER_RESPONSE");
  }
  return content.trim();
}

export async function completeOpenRouterVisionJsonString(
  config: OpenRouterConfig,
  systemPrompt: string,
  userText: string,
  imageDataUrl: string,
  requestSignal?: AbortSignal,
): Promise<string> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(120000),
    ...(requestSignal ? [requestSignal] : []),
  ]);
  const response = await post(
    config,
    JSON.stringify({
      model: config.model,
      stream: false,
      max_tokens: maxOutputTokens(),
      response_format: { type: "json_object" },
      provider: { sort: "latency", allow_fallbacks: true },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal,
  );
  const data = (await response.json()) as {
    choices?: { message?: { content?: string | unknown } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  throw new Error("INVALID_OPENROUTER_VISION_RESPONSE");
}

export async function completeOpenRouterJson<T>(
  config: OpenRouterConfig,
  systemPrompt: string,
  input: string,
  parse: (value: unknown) => T,
  requestSignal?: AbortSignal,
): Promise<T> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(120000),
    ...(requestSignal ? [requestSignal] : []),
  ]);
  const response = await post(
    config,
    requestBody(config, [{ role: "user", content: input }], systemPrompt, false),
    signal,
  );
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("INVALID_OPENROUTER_RESPONSE");
  }
  return parse(JSON.parse(content));
}
