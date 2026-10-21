import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSpreadsheetCsv } from "@/lib/csv/analyze-sales";
import type { CsvAnalysisGoal } from "@/lib/csv/analysis-goals";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { usesCloudPersistence } from "@/lib/auth/cloud-persistence";
import { consumeQuota } from "@/lib/limits/consume-quota";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveChatProvider } from "@/lib/ai/chat-runtime";

export const runtime = "nodejs";

const BODY_LIMIT = 512000;
const CSV_ANALYZE_QUOTA = 30;

const goalSchema = z.enum([
  "overview",
  "revenue",
  "costs_profit",
  "trends",
  "top_items",
  "cash_flow",
]);

const requestSchema = z
  .object({
    fileName: z.string().min(1).max(200).optional(),
    csv: z.string().min(1).max(400000),
    goal: goalSchema.optional().default("overview"),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity();
    requireRequestOrigin(request);

    if (!resolveChatProvider()) {
      throw new ApiError("SERVICE_UNAVAILABLE", 503);
    }

    const raw = await readJsonBody(request, BODY_LIMIT);
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError("INVALID_REQUEST", 400);

    const fileName = parsed.data.fileName?.trim() || "sales-data.csv";
    if (!fileName.toLowerCase().endsWith(".csv")) {
      throw new ApiError("INVALID_REQUEST", 400);
    }

    if (usesCloudPersistence(identity)) {
      const quota = await consumeQuota(
        getSupabaseAdmin(),
        identity.userId,
        CSV_ANALYZE_QUOTA,
      );
      if (!quota.allowed) throw new ApiError(quota.code, 429);
    }

    const result = await analyzeSpreadsheetCsv(
      parsed.data.csv,
      fileName,
      parsed.data.goal as CsvAnalysisGoal,
      request.signal,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY_CSV") {
      return apiErrorResponse(new ApiError("INVALID_REQUEST", 400));
    }
    return apiErrorResponse(error);
  }
}
