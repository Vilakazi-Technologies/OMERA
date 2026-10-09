import { cookies } from "next/headers";

export const OMERA_USER_COOKIE = "omera_uid";

export async function getUserIdFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(OMERA_USER_COOKIE)?.value ?? null;
}
