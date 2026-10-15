import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAdminClient = Pick<SupabaseClient, "rpc">;

export type QuotaResult =
  | { allowed: true; remaining: number }
  | { allowed: false; code: "QUOTA_EXCEEDED" };

type QuotaRow = { allowed: boolean; remaining: number };

export async function consumeQuota(
  admin: SupabaseAdminClient,
  userId: string,
  limit: number,
): Promise<QuotaResult> {
  if (!userId) throw new Error("INVALID_QUOTA_USER");
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("INVALID_QUOTA_LIMIT");
  const { data, error } = await admin.rpc("omera_consume_request_quota", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  const row: QuotaRow | undefined = Array.isArray(data)
    ? (data[0] as QuotaRow | undefined)
    : (data as QuotaRow | undefined);
  if (!row || typeof row.allowed !== "boolean") throw new Error("INVALID_QUOTA_RESULT");
  if (!row.allowed) return { allowed: false, code: "QUOTA_EXCEEDED" };
  return { allowed: true, remaining: row.remaining };
}
