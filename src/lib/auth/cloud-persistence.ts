import "server-only";
import type { Identity } from "@/lib/auth/require-identity";
import { isClerkUserId } from "@/lib/auth/require-identity";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/** True when chat/forms should use Supabase rows for this signed-in user. */
export function usesCloudPersistence(identity: Identity): boolean {
  return isSupabaseConfigured() && !isClerkUserId(identity.userId);
}
