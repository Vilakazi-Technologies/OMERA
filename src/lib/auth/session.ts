/**
 * Legacy cookie name, kept exported for one release so deployed clients and
 * the logout path can clear it. Its value is never identity proof: always
 * verify through `requireIdentity` first.
 */
export const OMERA_USER_COOKIE = "omera_uid";

/**
 * Legacy unsigned cookie read. It always resolves to null so no caller can
 * treat the cookie value as an authenticated identity. Route handlers must
 * use `requireIdentity` with a request-scoped `AuthContext` instead.
 *
 * @deprecated Use `requireIdentity` from `@/lib/auth/require-identity`.
 */
export async function getUserIdFromCookies(): Promise<null> {
  return null;
}
