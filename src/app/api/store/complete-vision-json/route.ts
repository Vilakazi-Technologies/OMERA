import { NextResponse } from "next/server";
import {
  completeOpenRouterVisionJsonString,
  getOpenRouterVisionConfig,
  isOpenRouterConfigured,
} from "@/lib/ai/openrouter-client";
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
    const config = getOpenRouterVisionConfig();
    const raw = await completeOpenRouterVisionJsonString(
      config,
      body.system,
      body.user,
      body.imageDataUrl
    );
    return NextResponse.json({
      raw,
      model: config.model,
      poweredBy: config.model.includes("flash-lite")
        ? "ViLATECH AI · Gemini 2.5 Flash Lite"
        : "ViLATECH AI · Gemini 2.5 Flash",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Vision completion failed";
    console.error("[complete-vision-json]", detail, err);
    return NextResponse.json({ error: detail.slice(0, 200) }, { status: 502 });
  }
}
