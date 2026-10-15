import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createOmeraUserForAuthId } from "@/lib/db/users";
import { integrationTarget } from "./setup";

/**
 * The admin client must resolve to the validated isolated target.
 * A different host means the run would touch another database.
 */
export function assertIsolatedTarget(): void {
  const url = process.env.SUPABASE_URL;
  if (!url || new URL(url).href !== integrationTarget) {
    throw new Error("ISOLATED_DATABASE_REQUIRED");
  }
}

export type TestIdentity = {
  authUserId: string;
  userId: string;
  email: string;
};

/** Create 1 verified auth identity and its mapped application user. */
export async function createTestIdentity(
  label: string,
): Promise<TestIdentity> {
  assertIsolatedTarget();
  const admin = getSupabaseAdmin();
  const email = `omera-itest-${label}-${randomUUID()}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error("IDENTITY_CREATE_FAILED");
  const userId = await createOmeraUserForAuthId(data.user.id, `itest-${label}`);
  return { authUserId: data.user.id, userId, email };
}

/** Remove every row and the auth user that a test identity created. */
export async function deleteTestIdentity(
  identity: TestIdentity,
): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from("omera_form_sessions")
    .delete()
    .eq("user_id", identity.userId);
  await admin
    .from("omera_conversations")
    .delete()
    .eq("user_id", identity.userId);
  await admin
    .from("omera_request_counts")
    .delete()
    .eq("user_id", identity.userId);
  await admin.auth.admin.deleteUser(identity.authUserId);
}
