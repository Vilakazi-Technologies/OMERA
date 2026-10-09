import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/ai/config";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  const openai = getOpenAIConfig();
  return NextResponse.json({
    status: "ok",
    service: "omera",
    chat: {
      mode: openai.enabled ? "openai" : "demo",
      model: openai.enabled ? openai.model : null,
    },
    voice: {
      configured: Boolean(process.env.LELAPA_API_KEY?.trim()),
    },
    database: {
      configured: isSupabaseConfigured(),
    },
  });
}
