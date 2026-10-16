import "server-only";

/**
 * Honest health model.
 *
 * Xavani configuration, service compatibility, and inference availability
 * are reported separately. A present key never proves compatibility or
 * successful inference — both stay "unverified" until a live service
 * check runs. The health route performs no live inference check, so a
 * fully configured provider reports "configured", never "healthy".
 */

export type XavaniState = "unavailable" | "configured";
export type OverallStatus = "ok" | "degraded" | "unavailable";

export type XavaniHealth = {
  configured: boolean;
  state: XavaniState;
  /** Only a live capabilities check can verify compatibility. */
  compatibility: "unverified";
  /** Only a live inference round trip can verify availability. */
  inference: "unverified";
};

export function xavaniHealth(
  env: NodeJS.ProcessEnv = process.env,
): XavaniHealth {
  const apiKey = env.XAVANI_API_KEY?.trim();
  const baseUrl = env.XAVANI_BASE_URL?.trim();
  const xavani = Boolean(apiKey && baseUrl);
  const openRouter = Boolean(
    env.OPENROUTER_API_KEY?.trim() && env.OPENROUTER_MODEL?.trim(),
  );
  const configured = xavani || openRouter;
  return {
    configured,
    state: configured ? "configured" : "unavailable",
    compatibility: "unverified",
    inference: "unverified",
  };
}

export type DatabaseHealth = {
  configured: boolean;
  /** null when unconfigured and never probed. */
  reachable: boolean | null;
};

/**
 * Run a reachability probe with a hard timeout. A slow or failing
 * database reports unreachable; it never blocks the response.
 */
export async function databaseReachable(
  probe: () => Promise<unknown>,
  timeoutMs = 2000,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("HEALTH_DB_TIMEOUT")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function overallStatus(input: {
  xavani: XavaniHealth;
  database: DatabaseHealth;
}): OverallStatus {
  if (input.xavani.state === "unavailable") return "unavailable";
  if (input.database.configured && input.database.reachable !== true) {
    return "degraded";
  }
  return "ok";
}
