import "server-only";
import { ApiError } from "@/lib/http/api-error";

export function requireRequestOrigin(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): void {
  let approved: URL;
  try {
    approved = new URL(env.APP_ORIGIN ?? "");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(approved.hostname);
    const development = env.NODE_ENV !== "production" && loopback && approved.protocol === "http:";
    if ((!development && approved.protocol !== "https:") || approved.username ||
        approved.password || approved.pathname !== "/" || approved.search || approved.hash) {
      throw new Error("INVALID_ORIGIN_CONFIG");
    }
  } catch {
    throw new ApiError("SERVICE_UNAVAILABLE", 503);
  }
  const origin = request.headers.get("Origin");
  if (origin !== approved.origin) {
    const referer = request.headers.get("Referer");
    const refererOk =
      typeof referer === "string" && referer.startsWith(`${approved.origin}/`);
    if (origin !== null || !refererOk) {
      throw new ApiError("ORIGIN_FORBIDDEN", 403);
    }
  }
}
