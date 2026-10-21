import { NextResponse } from "next/server";
import {
  OMERA_MODEL_ID,
  openRouterModelForSelection,
  resolveChatModelForRequest,
} from "@/lib/ai/model-catalog";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { usesCloudPersistence } from "@/lib/auth/cloud-persistence";
import { chatRequestSchema } from "@/lib/ai/chat-request";
import { getConversation } from "@/lib/db/conversations";
import { consumeQuota } from "@/lib/limits/consume-quota";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createConfiguredChatStream } from "@/lib/ai/chat-runtime";
import { createDemoChatStream } from "@/lib/ai/demo-stream";
import { runtimeMode } from "@/lib/ai/runtime-mode";
import { buildWebResearchSystemContextBounded } from "@/lib/search/web-research";

export const runtime = "nodejs";

const CHAT_BODY_LIMIT = 256000;
function chatQuotaLimit(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CHAT_QUOTA_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 150;
  if (!Number.isFinite(parsed) || parsed < 30) return 150;
  return Math.min(500, parsed);
}

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(request);
    const raw = await readJsonBody(request, CHAT_BODY_LIMIT);
    const parsed = chatRequestSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError("INVALID_REQUEST", 400);
    const { conversationId, messages, replyLanguageId, modelId, webResearch } =
      parsed.data;
    const cloud = usesCloudPersistence(identity);

    if (conversationId && cloud) {
      const conversation = await getConversation(
        conversationId,
        identity.userId,
      );
      if (!conversation) throw new ApiError("NOT_FOUND", 404);
    }

    if (cloud) {
      const quota = await consumeQuota(
        getSupabaseAdmin(),
        identity.userId,
        chatQuotaLimit(),
      );
      if (!quota.allowed) throw new ApiError(quota.code, 429);
    }

    const routing = resolveChatModelForRequest(modelId);
    if (!routing) throw new ApiError("SERVICE_UNAVAILABLE", 503);

    const openRouterOverride =
      routing.provider === "openrouter" && routing.modelId !== OMERA_MODEL_ID
        ? routing.modelId
        : routing.provider === "openrouter"
          ? openRouterModelForSelection(OMERA_MODEL_ID)
          : undefined;

    let webResearchContext: string | null = null;
    if (webResearch) {
      const lastUser = messages.findLast((message) => message.role === "user");
      if (lastUser) {
        webResearchContext = await buildWebResearchSystemContextBounded(
          lastUser.content,
          request.signal,
        );
      }
    }

    let stream: ReadableStream<Uint8Array>;
    try {
      stream = createConfiguredChatStream(
        messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        replyLanguageId,
        request.signal,
        openRouterOverride,
        webResearchContext,
      );
    } catch {
      if (runtimeMode(process.env.XAVANI_API_KEY, process.env) !== "demo") {
        throw new ApiError("SERVICE_UNAVAILABLE", 503);
      }
      const lastUser = [...messages]
        .reverse()
        .find((message) => message.role === "user");
      stream = createDemoChatStream(lastUser?.content ?? "");
    }

    return new NextResponse(stream, { headers: STREAM_HEADERS });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
