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
import { combineSystemContext, type ModelTurn } from "@/lib/ai/advisor-memory";
import { threadForModel } from "@/lib/ai/chat-history";
import { chatRequestSchema } from "@/lib/ai/chat-request";
import { loadAdvisorModelContext } from "@/lib/ai/load-advisor-context";
import { getConversation } from "@/lib/db/conversations";
import { consumeQuota } from "@/lib/limits/consume-quota";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createConfiguredChatStream, researchHandledByXavani, resolveChatProvider } from "@/lib/ai/chat-runtime";
import { createDemoChatStream } from "@/lib/ai/demo-stream";
import { runtimeMode } from "@/lib/ai/runtime-mode";
import { xavaniResearchAvailable } from "@/lib/ai/xavani-client";
import { buildWebResearchSystemContextBounded } from "@/lib/search/web-research";

export const runtime = "nodejs";
/** Vercel cuts a function at 60 s. Replies must finish before that. */
export const maxDuration = 60;

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
    const { conversationId, messages, replyLanguageId, modelId, webResearch, accountMemory } =
      parsed.data;
    const cloud = usesCloudPersistence(identity);

    let storedThread: ModelTurn[] = [];
    if (conversationId && cloud) {
      const conversation = await getConversation(
        conversationId,
        identity.userId,
      );
      if (!conversation) throw new ApiError("NOT_FOUND", 404);
      storedThread = conversation.messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .filter((message) => message.content.trim().length > 0)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));
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

    const provider = resolveChatProvider();
    const xavaniResearch =
      webResearch && provider === "xavani"
        ? await xavaniResearchAvailable(request.signal)
        : false;
    const researchOnXavani = researchHandledByXavani(
      webResearch, provider, xavaniResearch,
    );

    const lastUser = messages.findLast((message) => message.role === "user");
    const [webResearchContext, memoryContext] = await Promise.all([
      webResearch && !researchOnXavani && lastUser
        ? buildWebResearchSystemContextBounded(lastUser.content, request.signal)
        : Promise.resolve(null),
      loadAdvisorModelContext({
        userId: identity.userId,
        cloud,
        conversationId,
        replyLanguageId,
        accountMemory: cloud ? null : accountMemory,
      }),
    ]);
    const systemContext = combineSystemContext(memoryContext, webResearchContext);
    const thread = threadForModel(
      storedThread,
      messages.map((message) => ({ role: message.role, content: message.content })),
    );

    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await createConfiguredChatStream(
        thread,
        replyLanguageId,
        request.signal,
        openRouterOverride,
        systemContext,
        researchOnXavani ? true : undefined,
      );
    } catch {
      if (runtimeMode(process.env.XAVANI_API_KEY, process.env) !== "demo") {
        throw new ApiError("SERVICE_UNAVAILABLE", 503);
      }
      const fallbackUser = [...messages]
        .reverse()
        .find((message) => message.role === "user");
      stream = createDemoChatStream(fallbackUser?.content ?? "");
    }

    return new NextResponse(stream, { headers: STREAM_HEADERS });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
