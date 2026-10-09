import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function upsertOmeraUser(
  displayName: string,
  email?: string | null,
) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email?.trim().toLowerCase() || null;

  if (normalizedEmail) {
    const { data: existing } = await supabase
      .from("omera_users")
      .select("id, display_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("omera_users")
        .update({ display_name: displayName })
        .eq("id", existing.id);
      return existing.id as string;
    }
  }

  const { data, error } = await supabase
    .from("omera_users")
    .insert({
      email: normalizedEmail,
      display_name: displayName,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
