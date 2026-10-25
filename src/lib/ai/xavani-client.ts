import "server-only";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";

export type XavaniConfig = { baseUrl: string; apiKey: string; model: string };
type Message = { role: "user" | "assistant"; content: string };

export function getXavaniConfig(env: NodeJS.ProcessEnv = process.env): XavaniConfig {
  const apiKey = env.XAVANI_API_KEY?.trim();
  const rawUrl = env.XAVANI_BASE_URL?.trim();
  if (!apiKey || !rawUrl) throw new Error("XAVANI_UNAVAILABLE");
  const url = new URL(rawUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("INVALID_XAVANI_URL");
  }
  if (/[\r\n]/.test(env.XAVANI_API_KEY ?? "")) throw new Error("INVALID_XAVANI_KEY");
  return { baseUrl: url.origin, apiKey, model: env.XAVANI_MODEL?.trim() || "omera" };
}

function requestBody(
  config: XavaniConfig,
  messages: Message[],
  systemPrompt: string,
  stream: boolean,
  research?: boolean,
) {
  const body: Record<string, unknown> = {
    model: config.model,
    stream,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  };
  if (research !== undefined) body.xavani_research = research;
  return JSON.stringify(body);
}

const ASSERT_CACHE_TTL_MS = 5 * 60 * 1000;
const BREAKER_MS = 30_000;
const DEFAULT_REACHABILITY_MS = 8000;

function xavaniReachabilityMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.XAVANI_REACHABILITY_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_REACHABILITY_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_REACHABILITY_MS;
  return Math.min(15_000, Math.max(2000, parsed));
}
let assertCache: { key: string; expiresAt: number; research: boolean } | null = null;
let downUntil = 0;

/** Stop probing a service that just failed. */
export function markXavaniDown(ms: number = BREAKER_MS): void {
  downUntil = Date.now() + ms;
}

export function xavaniIsDown(): boolean {
  return Date.now() < downUntil;
}

/** Tests only. */
export function clearXavaniBreaker(): void {
  downUntil = 0;
}

async function assertService(
  config: XavaniConfig,
  signal: AbortSignal,
): Promise<{ research: boolean }> {
  const cacheKey = `${config.baseUrl}|${config.model}`;
  if (assertCache?.key === cacheKey && assertCache.expiresAt > Date.now()) {
    return { research: assertCache.research };
  }
  const response = await fetch(`${config.baseUrl}/v1/capabilities`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    signal, redirect: "error", cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("XAVANI_UNAVAILABLE");
  }
  const capabilities = object(await readJson(response));
  const auth = object(capabilities.auth);
  const service = object(capabilities.service);
  if (capabilities.model !== config.model || auth.required !== true ||
      service.name !== "omera" || service.contract !== 1 ||
      service.stateless_requests !== true || service.tools_enabled !== false ||
      service.memory_enabled !== false || service.context_files_enabled !== false ||
      service.transcript_persistence !== false) {
    throw new Error("UNSAFE_XAVANI_SERVICE");
  }
  const research = object(service.research ?? {});
  const state = { research: research.enabled === true };
  assertCache = { key: cacheKey, expiresAt: Date.now() + ASSERT_CACHE_TTL_MS, ...state };
  downUntil = 0;
  return state;
}

/** Resets cached capability checks (tests only). */
export function clearXavaniCapabilityCache(): void {
  assertCache = null;
  downUntil = 0;
}

/** True when the service advertises server-side research. Never throws. */
export async function xavaniResearchAvailable(
  requestSignal?: AbortSignal,
  config?: XavaniConfig,
): Promise<boolean> {
  try {
    const resolved = config ?? getXavaniConfig();
    const signal = AbortSignal.any([
      AbortSignal.timeout(5000),
      ...(requestSignal ? [requestSignal] : []),
    ]);
    return (await assertService(resolved, signal)).research;
  } catch {
    return false;
  }
}

/** True when the service answers capabilities within 2 seconds. */
export async function xavaniReachable(
  requestSignal?: AbortSignal,
  config?: XavaniConfig,
): Promise<boolean> {
  if (xavaniIsDown()) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resolved = config ?? getXavaniConfig();
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), xavaniReachabilityMs());
    const signal = AbortSignal.any([
      controller.signal,
      ...(requestSignal ? [requestSignal] : []),
    ]);
    await assertService(resolved, signal);
    return true;
  } catch {
    markXavaniDown();
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("INVALID_XAVANI_RESPONSE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let content = "";
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 262144) throw new Error("XAVANI_RESPONSE_TOO_LARGE");
      content += decoder.decode(chunk.value, { stream: true });
    }
    content += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return JSON.parse(content);
}

async function request(config: XavaniConfig, body: string, signal: AbortSignal) {
  const service = await assertService(config, signal);
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal,
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("XAVANI_UNAVAILABLE");
  }
  return { response, service };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_XAVANI_RESPONSE");
  return value as Record<string, unknown>;
}

function choice(value: unknown): Record<string, unknown> {
  const data = object(value);
  if (data.error) throw new Error("XAVANI_UNAVAILABLE");
  if (data.xavani) {
    const state = object(data.xavani);
    if (state.failed || state.partial || state.completed === false) throw new Error("INCOMPLETE_XAVANI_RESPONSE");
  }
  if (!Array.isArray(data.choices) || data.choices.length !== 1) throw new Error("INVALID_XAVANI_RESPONSE");
  return object(data.choices[0]);
}

async function* tokens(response: Response): AsyncGenerator<string> {
  if (!response.headers.get("content-type")?.startsWith("text/event-stream") || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("INVALID_XAVANI_STREAM");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let stopped = false;
  let visible = false;
  try {
    while (true) {
      const chunk = await reader.read();
      pending += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      pending = pending.replace(/\r\n/g, "\n");
      if (pending.length > 262144) throw new Error("XAVANI_EVENT_TOO_LARGE");
      let boundary = pending.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const lines = frame.split("\n");
        if (lines.some((line) => line.startsWith("event:") && line.slice(6).trim() !== "message")) {
          throw new Error("UNEXPECTED_XAVANI_EVENT");
        }
        const data = lines.filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (data === "[DONE]") {
          if (!stopped || !visible) throw new Error("INCOMPLETE_XAVANI_STREAM");
          return;
        }
        if (data) {
          if (stopped) throw new Error("INVALID_XAVANI_STREAM");
          const item = choice(JSON.parse(data));
          const delta = object(item.delta);
          if (delta.tool_calls) throw new Error("UNEXPECTED_XAVANI_TOOL");
          if (delta.content !== undefined && delta.content !== null) {
            if (typeof delta.content !== "string") throw new Error("INVALID_XAVANI_TOKEN");
            if (delta.content.trim()) visible = true;
            if (delta.content) yield delta.content;
          }
          if (item.finish_reason !== null && item.finish_reason !== undefined) {
            if (item.finish_reason !== "stop") throw new Error("INCOMPLETE_XAVANI_STREAM");
            stopped = true;
          }
        }
        boundary = pending.indexOf("\n\n");
      }
      if (chunk.done) throw new Error("INCOMPLETE_XAVANI_STREAM");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createXavaniChatStream(
  config: XavaniConfig,
  messages: Message[],
  replyLanguageId: string | null = null,
  requestSignal?: AbortSignal,
  systemContext?: string | null,
  research?: boolean,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal, AbortSignal.timeout(120000),
    ...(requestSignal ? [requestSignal] : []),
  ]);
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(output) {
      try {
        const { response } = await request(
          config,
          requestBody(
            config,
            messages,
            buildOmeraSystemPrompt(replyLanguageId, systemContext),
            true,
            research,
          ),
          signal,
        );
        for await (const token of tokens(response)) {
          if (cancelled) return;
          output.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        }
        if (!cancelled) {
          output.enqueue(encoder.encode("data: [DONE]\n\n"));
          output.close();
        }
      } catch {
        markXavaniDown();
        if (!cancelled) {
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

export async function completeXavaniJson<T>(
  config: XavaniConfig,
  systemPrompt: string,
  input: string,
  parse: (value: unknown) => T,
  requestSignal?: AbortSignal,
): Promise<T> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(120000), ...(requestSignal ? [requestSignal] : []),
  ]);
  const { response } = await request(config, requestBody(
    config, [{ role: "user", content: input }], systemPrompt, false,
  ), signal);
  const item = choice(await readJson(response));
  if (item.finish_reason !== "stop") throw new Error("INCOMPLETE_XAVANI_RESPONSE");
  const message = object(item.message);
  if (typeof message.content !== "string") throw new Error("INVALID_XAVANI_RESPONSE");
  return parse(JSON.parse(message.content));
}
