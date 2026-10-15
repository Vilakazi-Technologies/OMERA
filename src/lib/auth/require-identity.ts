import "server-only";
import { ApiError } from "@/lib/http/api-error";
import {
  createOmeraUserForAuthId,
  findOmeraUserByAuthId,
} from "@/lib/db/users";
import type { AuthContext } from "@/lib/supabase/server";

export type Identity = { userId: string; authUserId: string };

export async function requireIdentity(context: AuthContext): Promise<Identity> {
  const {
    data: { user },
    error,
  } = await context.supabase.auth.getUser();
  if (error || !user) throw new ApiError("UNAUTHORIZED", 401);

  const existing = await findOmeraUserByAuthId(user.id);
  if (existing) return { userId: existing, authUserId: user.id };

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof metadata["display_name"] === "string" &&
    metadata["display_name"].trim()
      ? (metadata["display_name"] as string).trim()
      : "Omera user";
  const userId = await createOmeraUserForAuthId(user.id, displayName);
  return { userId, authUserId: user.id };
}
