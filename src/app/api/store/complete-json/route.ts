import { NextResponse } from "next/server";
import {
  completeOpenRouterJsonString,
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from "@/lib/ai/openrouter-client";
import { resolveOpenRouterModelId } from "@/lib/ai/openrouter-models";
import { authorizeStoreGateway } from "@/lib/store-gateway/authorize";

export const runtime = "nodejs";

/** Lorraine Beauté — JSON completion via same OpenRouter / Gemini stack as ViLATECH AI chat. */
export async function POST(req: Request) {
  const denied = authorizeStoreGateway(req);
  if (denied) return denied;

  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: "OpenRouter not configured on ViLATECH AI" }, { status: 503 });
  }

  let body: { system?: string; user?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.system || !body.user) {
    return NextResponse.json({ error: "system and user required" }, { status: 400 });
  }

  try {
    const config = getOpenRouterConfig();
    const raw = await completeOpenRouterJsonString(config, body.system, body.user);
    return NextResponse.json({
      raw,
      model: resolveOpenRouterModelId(),
      poweredBy: "ViLATECH AI · Gemini 2.5 Flash",
    });
  } catch {
    return NextResponse.json({ error: "Completion failed" }, { status: 502 });
  }
}
