import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function findOmeraUserByAuthId(
  authUserId: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

export async function createOmeraUserForAuthId(
  authUserId: string,
  displayName: string,
  email?: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  // Idempotent under concurrent first logins: both racers upsert the same
  // unique key and then read back the single surviving row, so the loser
  // never surfaces a unique violation. Duplicates are ignored rather than
  // updated so a stale display name cannot clobber a newer one.
  const { error } = await supabase.from("omera_users").upsert(
    {
      auth_user_id: authUserId,
      email: email ?? null,
      display_name: displayName,
    },
    { onConflict: "auth_user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  const winner = await findOmeraUserByAuthId(authUserId);
  if (!winner) throw new Error("IDENTITY_CREATE_FAILED");
  return winner;
}

/**
 * Legacy bootstrap path, neutered for one release. It never selects a user
 * by email: every call inserts a fresh row with `email: null`. Closed by the
 * verified OTP routes; do not use for identity mapping.
 */
export async function upsertOmeraUser(
  displayName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _email?: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("omera_users")
    .insert({
      email: null,
      display_name: displayName,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
