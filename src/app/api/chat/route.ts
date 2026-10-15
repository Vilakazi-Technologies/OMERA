import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { createAuthContext } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/ai/chat-request";
import { getConversation } from "@/lib/db/conversations";
import { consumeQuota } from "@/lib/limits/consume-quota";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createXavaniChatStream,
  getXavaniConfig,
} from "@/lib/ai/xavani-client";
import { createDemoChatStream } from "@/lib/ai/demo-stream";
import { runtimeMode } from "@/lib/ai/runtime-mode";

export const runtime = "nodejs";

const CHAT_BODY_LIMIT = 256000;
const CHAT_QUOTA_LIMIT = 60;

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  try {
    const auth = await createAuthContext();
    const identity = await requireIdentity(auth);
    requireRequestOrigin(request);
    const raw = await readJsonBody(request, CHAT_BODY_LIMIT);
    const parsed = chatRequestSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError("INVALID_REQUEST", 400);
    const { conversationId, messages, replyLanguageId } = parsed.data;
    if (conversationId) {
      const conversation = await getConversation(
        conversationId,
        identity.userId,
      );
      if (!conversation) throw new ApiError("NOT_FOUND", 404);
    }
    const quota = await consumeQuota(
      getSupabaseAdmin(),
      identity.userId,
      CHAT_QUOTA_LIMIT,
    );
    if (!quota.allowed) throw new ApiError(quota.code, 429);

    let stream: ReadableStream<Uint8Array>;
    try {
      const config = getXavaniConfig();
      stream = createXavaniChatStream(
        config,
        messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        replyLanguageId,
        request.signal,
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

    return auth.applyCookies(
      new NextResponse(stream, { headers: STREAM_HEADERS }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
