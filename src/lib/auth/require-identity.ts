import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ApiError } from "@/lib/http/api-error";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  createOmeraUserForAuthId,
  findOmeraUserByAuthId,
} from "@/lib/db/users";

export type Identity = { userId: string; authUserId: string };

export function isClerkUserId(userId: string): boolean {
  return userId.startsWith("user_");
}

/** Clerk is the only auth provider. Supabase (if configured) stores app data only. */
export async function requireIdentity(): Promise<Identity> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new ApiError("UNAUTHORIZED", 401);

  if (!isSupabaseConfigured()) {
    return { userId: clerkUserId, authUserId: clerkUserId };
  }

  try {
    const existing = await findOmeraUserByAuthId(clerkUserId);
    if (existing) return { userId: existing, authUserId: clerkUserId };

    const clerkUser = await currentUser();
    const displayName =
      clerkUser?.fullName?.trim() ||
      clerkUser?.firstName?.trim() ||
      clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
      "Omera user";
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
    const userId = await createOmeraUserForAuthId(
      clerkUserId,
      displayName,
      email,
    );
    return { userId, authUserId: clerkUserId };
  } catch {
    // DB not migrated or transient failure — still allow Clerk sign-in (local mode).
    return { userId: clerkUserId, authUserId: clerkUserId };
  }
}
