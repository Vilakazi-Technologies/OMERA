import { NextResponse } from "next/server";
import { buildModelCatalog } from "@/lib/ai/model-catalog";
import { resolveChatProvider } from "@/lib/ai/chat-runtime";
import {
  databaseReachable,
  overallStatus,
  xavaniHealth,
} from "@/lib/health/status";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Hard bound on the database reachability probe. */
const DB_TIMEOUT_MS = 2000;

export async function GET() {
  const xavani = xavaniHealth();
  const dbConfigured = isSupabaseConfigured();
  let dbReachable: boolean | null = null;
  if (dbConfigured) {
    dbReachable = await databaseReachable(async () => {
      const admin = getSupabaseAdmin();
      const { error } = await admin
        .from("omera_conversations")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (error) throw error;
    }, DB_TIMEOUT_MS);
  }
  const database = { configured: dbConfigured, reachable: dbReachable };
  const catalog = buildModelCatalog();
  const primary = catalog.models.find((m) => m.kind === "primary");
  return NextResponse.json({
    status: overallStatus({ xavani, database }),
    service: "omera",
    chat: {
      ...xavani,
      provider: resolveChatProvider(),
      primaryModel: primary?.id ?? null,
      primaryLabel: primary?.label ?? null,
    },
    voice: {
      configured: Boolean(
        process.env.LELAPA_API_KEY?.trim() ||
          process.env.OPENROUTER_API_KEY?.trim(),
      ),
    },
    forms: {
      storage: dbConfigured,
      ai: catalog.provider !== "unconfigured",
    },
    database,
  });
}
