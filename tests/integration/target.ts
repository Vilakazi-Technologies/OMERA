export function validateIntegrationTarget(
  productionUrl: string | undefined,
  testUrl: string | undefined,
): string {
  if (!productionUrl || !testUrl) {
    throw new Error("ISOLATED_DATABASE_REQUIRED");
  }

  try {
    const production = new URL(productionUrl);
    const target = new URL(testUrl);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const productionLoopback = loopbackHosts.has(production.hostname);
    const targetLoopback = loopbackHosts.has(target.hostname);
    for (const url of [production, target]) {
      const isLoopback = loopbackHosts.has(url.hostname);
      const allowedHost = isLoopback
        ? url.protocol === "http:"
        : url.protocol === "https:" &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(url.hostname);
      if (
        !allowedHost ||
        url.username ||
        url.password ||
        url.href.includes("?") ||
        url.href.includes("#") ||
        url.pathname !== "/"
      ) {
        throw new Error("ISOLATED_DATABASE_REQUIRED");
      }
    }
    // Reject the same remote host, independent of its port.
    if (
      !productionLoopback &&
      !targetLoopback &&
      production.hostname === target.hostname
    ) {
      throw new Error("ISOLATED_DATABASE_REQUIRED");
    }
    if (
      productionLoopback &&
      targetLoopback &&
      (production.port || "80") === (target.port || "80")
    ) {
      throw new Error("ISOLATED_DATABASE_REQUIRED");
    }
    return target.href;
  } catch {
    throw new Error("ISOLATED_DATABASE_REQUIRED");
  }
}
