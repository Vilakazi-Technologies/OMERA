import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/ai/config";
import { createDemoChatStream } from "@/lib/ai/demo-stream";
import { createOpenAIChatStream } from "@/lib/ai/openai-stream";
export const runtime = "nodejs";

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: { role: string; content: string }[];
    conversationId?: string;
  };

  const messages = body.messages ?? [];
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  const { apiKey, model, enabled } = getOpenAIConfig();

  const stream = enabled
    ? createOpenAIChatStream(apiKey!, model, messages)
    : createDemoChatStream(lastUser?.content ?? "");

  return new NextResponse(stream, { headers: STREAM_HEADERS });
}

export async function GET() {
  const { enabled, model } = getOpenAIConfig();
  return NextResponse.json({
    provider: enabled ? "openai" : "demo",
    model: enabled ? model : null,
  });
}
