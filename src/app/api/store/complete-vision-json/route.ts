import { NextResponse } from "next/server";
import {
  completeOpenRouterVisionJsonString,
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from "@/lib/ai/openrouter-client";
import { resolveOpenRouterModelId } from "@/lib/ai/openrouter-models";
import { authorizeStoreGateway } from "@/lib/store-gateway/authorize";

export const runtime = "nodejs";

/** Lorraine Beauté skin scan — vision + JSON via ViLATECH AI OpenRouter. */
export async function POST(req: Request) {
  const denied = authorizeStoreGateway(req);
  if (denied) return denied;

  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: "OpenRouter not configured on ViLATECH AI" }, { status: 503 });
  }

  let body: { system?: string; user?: string; imageDataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.system || !body.user || !body.imageDataUrl) {
    return NextResponse.json({ error: "system, user, and imageDataUrl required" }, { status: 400 });
  }

  try {
    const config = getOpenRouterConfig();
    const raw = await completeOpenRouterVisionJsonString(
      config,
      body.system,
      body.user,
      body.imageDataUrl
    );
    return NextResponse.json({
      raw,
      model: resolveOpenRouterModelId(),
      poweredBy: "ViLATECH AI · Gemini 2.5 Flash",
    });
  } catch {
    return NextResponse.json({ error: "Vision completion failed" }, { status: 502 });
  }
}
