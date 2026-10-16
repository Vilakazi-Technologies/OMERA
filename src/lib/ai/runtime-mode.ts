export type RuntimeMode = "live" | "demo" | "unavailable";

export function runtimeMode(
  key: string | undefined,
  environment: NodeJS.ProcessEnv,
): RuntimeMode {
  if (key?.trim()) return "live";
  if (environment.OPENROUTER_API_KEY?.trim() && environment.OPENROUTER_MODEL?.trim()) {
    return "live";
  }
  if (
    environment.NODE_ENV !== "production" &&
    environment.OMERA_DEMO_MODE === "true"
  ) {
    return "demo";
  }
  return "unavailable";
}
